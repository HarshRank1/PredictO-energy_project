import xgboost as xgb
import os
import numpy as np
import pandas as pd

model_path = r'd:\\SDP_SEM6\\ml_models\\xgb_model_final_nonoverfitting_bestest.json'
booster = xgb.Booster()
booster.load_model(model_path)

import pandas as pd
import numpy as np
import xgboost as xgb
import requests

model_path = r'd:\\SDP_SEM6\\ml_models\\xgb_model_final_nonoverfitting_bestest.json'
booster = xgb.Booster()
booster.load_model(model_path)

def fetch_weather_hourly(lat, lon, start_date, end_date):
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat, "longitude": lon,
        "start_date": start_date, "end_date": end_date,
        "hourly": "temperature_2m,dewpoint_2m",
        "timezone": "Asia/Kolkata"
    }
    resp = requests.get(url, params=params).json()
    df = pd.DataFrame({"time": resp["hourly"]["time"], "temperature_2m": resp["hourly"]["temperature_2m"], "dewpoint_2m": resp["hourly"]["dewpoint_2m"]})
    df["time"] = pd.to_datetime(df["time"])
    return df.set_index("time")

def get_month_pred(month, days):
    start = f"2023-{month:02d}-01"
    end = f"2023-{month:02d}-{days}"
    df_1h = fetch_weather_hourly(22.7, 72.9, start, end)
    
    rows = []
    for ts, row in df_1h.iterrows():
        r = {f: 0.0 for f in booster.feature_names}
        r['square_feet'] = np.log1p(50000)
        r['building_age'] = 10
        r['air_temperature'] = float(row.get('temperature_2m', 20.0))
        r['dew_temperature'] = float(row.get('dewpoint_2m', 10.0))
        r['month_sin'] = float(np.sin(2 * np.pi * (ts.month - 1) / 12))
        r['month_cos'] = float(np.cos(2 * np.pi * (ts.month - 1) / 12))
        r['hour_sin'] = float(np.sin(2 * np.pi * ts.hour / 24))
        r['hour_cos'] = float(np.cos(2 * np.pi * ts.hour / 24))
        r['dow_sin'] = float(np.sin(2 * np.pi * ts.weekday() / 7))
        r['dow_cos'] = float(np.cos(2 * np.pi * ts.weekday() / 7))
        rows.append(r)
        
    dmat = xgb.DMatrix(pd.DataFrame(rows)[booster.feature_names].values, feature_names=booster.feature_names)
    preds = booster.predict(dmat)
    total = np.sum(np.expm1(preds) * 50000)
    print(f"Month {month} Total: {total:.2f}")

get_month_pred(4, 30) # April
get_month_pred(5, 31) # May


