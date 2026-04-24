import xgboost as xgb
import numpy as np

booster = xgb.Booster()
booster.load_model('d:/SDP_SEM6/ml_models/xgb_model_final_nonoverfitting_bestest.json')

features = booster.feature_names
print("Model features:", features)

# Test age 10
age10 = {
    'square_feet': float(np.log1p(10000)),
    'building_age': 10,
    'air_temperature': 25.0,
    'dew_temperature': 15.0,
    'primary_use_Education': 1.0,
    'primary_use_Entertainment/public assembly': 0.0,
    'primary_use_Food sales and service': 0.0,
    'primary_use_Healthcare': 0.0,
    'primary_use_Lodging/residential': 0.0,
    'primary_use_Manufacturing/industrial': 0.0,
    'primary_use_Office': 0.0,
    'primary_use_Other': 0.0,
    'primary_use_Parking': 0.0,
    'primary_use_Public services': 0.0,
    'primary_use_Religious worship': 0.0,
    'primary_use_Retail': 0.0,
    'primary_use_Services': 0.0,
    'primary_use_Technology/science': 0.0,
    'primary_use_Utility': 0.0,
    'primary_use_Warehouse/storage': 0.0,
    'hour_sin': 0.0,
    'hour_cos': 1.0,
    'dow_sin': 0.0,
    'dow_cos': 1.0,
    'month_sin': 0.0,
    'month_cos': 1.0
}

# Ensure correct order
row10 = [age10.get(f, 0.0) for f in features]
dmat10 = xgb.DMatrix([row10], feature_names=features)
pred10 = np.expm1(booster.predict(dmat10)[0]) * 10000

# Test age 100
age100 = age10.copy()
age100['building_age'] = 100

row100 = [age100.get(f, 0.0) for f in features]
dmat100 = xgb.DMatrix([row100], feature_names=features)
pred100 = np.expm1(booster.predict(dmat100)[0]) * 10000

print(f"Prediction for Age 10: {pred10}")
print(f"Prediction for Age 100: {pred100}")
