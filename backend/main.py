from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import joblib
import json
import numpy as np
import pandas as pd
import xgboost as xgb
import requests
from datetime import datetime

APP_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(os.path.dirname(APP_DIR), 'ml_models')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ForecastRequest(BaseModel):
    location: Optional[str]
    coords: Optional[dict]
    area: Optional[float]
    primary_use: Optional[str]
    yearBuilt: Optional[int]
    forecastMonth: Optional[str]


class ForecastResponse(BaseModel):
    model_name: str
    predictions: List[float]
    labels: List[str]


# Load models at startup
LOADED_MODELS = {}

def load_models():
    if not os.path.isdir(MODEL_DIR):
        print(f"Warning: Model directory {MODEL_DIR} not found.")
        return
    for fn in os.listdir(MODEL_DIR):
        path = os.path.join(MODEL_DIR, fn)
        name = fn
        try:
            if fn.endswith('.json'):
                booster = xgb.Booster()
                booster.load_model(path)
                LOADED_MODELS[name] = booster
                print(f"Loaded model: {name}")
        except Exception as e:
            print('Failed to load', fn, e)

load_models()


def month_name_to_index(name):
    names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    try:
        return names.index(name) + 1
    except Exception:
        # try full month names
        try:
            return datetime.strptime(name, '%B').month
        except Exception:
            return None


def make_features_for_month(area, yearBuilt, primary_use_dict, air_temp, dew_temp, month_idx, hour=12, dow=0):
    # compute building_age
    curr_year = datetime.now().year
    building_age = (curr_year - yearBuilt) if yearBuilt else 0

    meter_reading = 0.0
    # use defaults for weather if not provided
    if air_temp is None:
        air_temp = 20.0
    if dew_temp is None:
        dew_temp = 10.0

    hour_sin = np.sin(2 * np.pi * hour / 24)
    hour_cos = np.cos(2 * np.pi * hour / 24)
    dow_sin = np.sin(2 * np.pi * dow / 7)
    dow_cos = np.cos(2 * np.pi * dow / 7)
    month_sin = np.sin(2 * np.pi * (month_idx - 1) / 12)
    month_cos = np.cos(2 * np.pi * (month_idx - 1) / 12)

    # Build feature row (meter_reading is the target, not an input)
    row = {
        'square_feet': float(np.log1p(area or 0)),
        'building_age': building_age,
        'air_temperature': air_temp,
        'dew_temperature': dew_temp,
    }
    # primary uses (expected keys)
    primary_keys = ['primary_use_Education','primary_use_Entertainment/public assembly','primary_use_Food sales and service','primary_use_Healthcare','primary_use_Lodging/residential','primary_use_Manufacturing/industrial','primary_use_Office','primary_use_Other','primary_use_Parking','primary_use_Public services','primary_use_Religious worship','primary_use_Retail','primary_use_Services','primary_use_Technology/science','primary_use_Utility','primary_use_Warehouse/storage']
    for k in primary_keys:
        row[k] = 1.0 if primary_use_dict.get(k, False) else 0.0

    row['hour_sin'] = float(hour_sin)
    row['hour_cos'] = float(hour_cos)
    row['dow_sin'] = float(dow_sin)
    row['dow_cos'] = float(dow_cos)
    row['month_sin'] = float(month_sin)
    row['month_cos'] = float(month_cos)

    return row


def fetch_weather_hourly(lat, lon, start_date, end_date, timezone='Asia/Kolkata'):
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "temperature_2m,dewpoint_2m,wind_speed_10m",
        "timezone": timezone
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    df = pd.DataFrame({
        "time": data["hourly"]["time"],
        "temperature_2m": data["hourly"]["temperature_2m"],
        "dewpoint_2m": data["hourly"]["dewpoint_2m"],
        "wind_speed_10m": data["hourly"]["wind_speed_10m"]
    })
    df["time"] = pd.to_datetime(df["time"])
    df = df.set_index("time")
    return df


@app.post('/forecast')
def forecast(req: ForecastRequest):
    if not LOADED_MODELS:
        raise HTTPException(status_code=500, detail='No models loaded')
    print('Received forecast request for location:', req.location, 'coords:', req.coords, 'area:', req.area, 'yearBuilt:', req.yearBuilt, 'primary_use:', req.primary_use, 'forecastMonth:', req.forecastMonth)

    # default coords
    lat = 22.7
    lon = 72.9
    if req.coords:
        lat = req.coords.get('latitude', lat)
        lon = req.coords.get('longitude', lon)
        
    # Map primary_use to dict
    primary_use_dict = {}
    if req.primary_use:
        primary_use_dict[f'primary_use_{req.primary_use}'] = True

    # Determine date range for forecastMonth
    if req.forecastMonth:
        try:
            # Assume format is "Month Year", e.g. "Feb 2026"
            parts = req.forecastMonth.split(' ')
            if len(parts) == 2:
                m_str, y_str = parts
                m_idx = month_name_to_index(m_str)
                year = int(y_str)
            else:
                raise ValueError("Invalid format")
                
            # Open-Meteo Archive API only reliably serves past dates.
            # To forecast future energy usage based on typical weather patterns,
            # we proxy any year >= 2024 to the historical reference year 2023.
            weather_year = year if year <= 2023 else 2023
            
            start_date = datetime(weather_year, m_idx, 1).strftime('%Y-%m-%d')
            # end_date is the last day of the month in the proxy year
            next_month = m_idx % 12 + 1
            next_year = weather_year + 1 if m_idx == 12 else weather_year
            end_date = (datetime(next_year, next_month, 1) - pd.Timedelta(days=1)).strftime('%Y-%m-%d')
        except Exception as e:
            # default to current month proxy if bad format
            year = 2023
            month = datetime.now().month
            start_date = datetime(year, month, 1).strftime('%Y-%m-%d')
            next_month = month % 12 + 1
            next_year = year + 1 if month == 12 else year
            end_date = (datetime(next_year, next_month, 1) - pd.Timedelta(days=1)).strftime('%Y-%m-%d')
    else:
        # Default fallback
        year = 2023
        month = datetime.now().month
        start_date = datetime(year, month, 1).strftime('%Y-%m-%d')
        next_month = month % 12 + 1
        next_year = year + 1 if month == 12 else year
        end_date = (datetime(next_year, next_month, 1) - pd.Timedelta(days=1)).strftime('%Y-%m-%d')


    try:
        weather_df = fetch_weather_hourly(lat, lon, start_date, end_date)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f'Weather fetch failed: {e}')

    # Downsample to every 4 hours, then resample to 1h via linear interpolation
    
    df_1h = weather_df
    # Build feature rows for each timestamp and keep timestamps for later aggregation
    rows = []
    timestamps = []
    for ts, row in df_1h.iterrows():
        if year != weather_year:
            try:
                ts = ts.replace(year=year)
            except ValueError:
                ts = ts + pd.DateOffset(years=year-weather_year)
        
        month_idx = ts.month
        hour = ts.hour
        dow = ts.weekday()
        air_temp = float(row.get('temperature_2m', 20.0))
        dew_temp = float(row.get('dewpoint_2m', 10.0))
        feat = make_features_for_month(req.area or 0, req.yearBuilt or 0, primary_use_dict, air_temp, dew_temp, month_idx, hour, dow)
        rows.append(feat)
        timestamps.append(ts)

    if not rows:
        raise HTTPException(status_code=400, detail='No weather rows to build features')

    features_df = pd.DataFrame(rows)

    results = []
    ratios_of_models = []
    for name, model in LOADED_MODELS.items():
        try:
            # Safely bypass any scikit-learn wrapper that might strip DataFrame columns
            booster = model.get_booster() if hasattr(model, 'get_booster') else model
            expected_feats = booster.feature_names
            
            if expected_feats:
                # Ensure all expected features are present
                for f in expected_feats:
                    if f not in features_df.columns:
                        features_df[f] = 0.0
                # Reorder and perfectly align DataFrame just for this model
                df_for_pred = features_df[expected_feats].copy()
                dmat = xgb.DMatrix(df_for_pred.values, feature_names=expected_feats)
            else:
                # Fallback if no specific feature names required
                dmat = xgb.DMatrix(features_df.values, feature_names=list(features_df.columns))

            # Directly predict using the xgboost Booster layer
            raw_preds = booster.predict(dmat)
            raw_preds = np.asarray(raw_preds).ravel()
            # inverse transform each prediction from log1p -> original, then sum
            preds_orig = np.expm1(raw_preds)
            print(name)
            print('\n\n')
            if(name.endswith('.json') or name.endswith('.pkl')):
                preds_orig = preds_orig*(req.area or 1)  # scale back up by area if model was trained on log1p(area) as feature
            total_pred = float(np.sum(preds_orig))

            # Build hourly_predictions/daily_predictions robustly even if model returns
            # a single aggregate value or per-day values instead of per-hour values.
            hourly_predictions = []
            daily_predictions = []
            try:
                n_hours = len(timestamps)
                # Case A: model returned one value (total for period)
                if preds_orig.size == 1:
                    total_val = float(preds_orig.ravel()[0])
                    per_hour = total_val / max(1, n_hours)
                    for ts in timestamps:
                        hourly_predictions.append({'timestamp': pd.to_datetime(ts).isoformat(), 'value': float(per_hour)})
                    # daily aggregate
                    s = pd.Series([h['value'] for h in hourly_predictions], index=pd.to_datetime(timestamps))
                    daily = s.resample('D').sum()
                    for idx, val in daily.items():
                        daily_predictions.append({'date': idx.strftime('%Y-%m-%d'), 'value': float(val)})

                # Case B: model returned per-hour predictions (ideal)
                elif len(preds_orig) == n_hours:
                    for ts, val in zip(timestamps, preds_orig):
                        hourly_predictions.append({'timestamp': pd.to_datetime(ts).isoformat(), 'value': float(val)})
                    s = pd.Series(preds_orig, index=pd.to_datetime(timestamps))
                    daily = s.resample('D').sum()
                    for idx, val in daily.items():
                        daily_predictions.append({'date': idx.strftime('%Y-%m-%d'), 'value': float(val)})

                # Case C: model returned per-day predictions (one value per unique day)
                else:
                    # try to map preds to unique days
                    uniq_days = pd.to_datetime(timestamps).normalize().unique()
                    if preds_orig.size == len(uniq_days):
                        # assign each daily value across that day's hours evenly
                        day_vals = list(np.asarray(preds_orig).ravel())
                        for day, val in zip(sorted(uniq_days), day_vals):
                            day_str = pd.to_datetime(day).strftime('%Y-%m-%d')
                            # hours in that day present in timestamps
                            day_ts = [ts for ts in timestamps if pd.to_datetime(ts).strftime('%Y-%m-%d') == day_str]
                            per_hour = float(val) / max(1, len(day_ts))
                            for ts in day_ts:
                                hourly_predictions.append({'timestamp': pd.to_datetime(ts).isoformat(), 'value': float(per_hour)})
                            daily_predictions.append({'date': day_str, 'value': float(val)})
                    else:
                        # fallback: cannot align shapes — create equal distribution from total_pred
                        per_hour = total_pred / max(1, n_hours)
                        for ts in timestamps:
                            hourly_predictions.append({'timestamp': pd.to_datetime(ts).isoformat(), 'value': float(per_hour)})
                        s = pd.Series([h['value'] for h in hourly_predictions], index=pd.to_datetime(timestamps))
                        daily = s.resample('D').sum()
                        for idx, val in daily.items():
                            daily_predictions.append({'date': idx.strftime('%Y-%m-%d'), 'value': float(val)})
            except Exception:
                # if anything goes wrong, return empty lists (frontend will show message)
                hourly_predictions = []
                daily_predictions = []

            results.append({
                'model_name': name,
                'predicted_total_one_month': total_pred,
                'hourly_predictions': hourly_predictions,
                'daily_predictions': daily_predictions
            })
            print('total_pred for', name, 'is', total_pred)
        except Exception as e:
            results.append({'model_name': name, 'error': str(e)})

    avg_air_temp = float(weather_df['temperature_2m'].mean()) if not weather_df.empty else 0.0
    avg_dew_temp = float(weather_df['dewpoint_2m'].mean()) if not weather_df.empty else 0.0

    return {
        'results': results, 
        'start_date': start_date, 
        'end_date': end_date, 
        'avg_air_temp': avg_air_temp,
        'avg_dew_temp': avg_dew_temp
    }


@app.post("/upload")
def upload_data(file: UploadFile = File(...)):
    # Placeholder for file upload
    return {"filename": file.filename}


@app.get("/hello")
def hello():
    return {"message": "Hello, World!"}

@app.get("/")
def read_root():
    return {"message": "Energy Forecasting API is running!"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)