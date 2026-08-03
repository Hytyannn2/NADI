# 🧠 NADI Civic OS — Physics-Informed Neural Network (PINN) & LSTM Flood Prediction Engine

## 📌 Executive Overview
This document outlines the architectural blueprint and implementation roadmap for upgrading **NADI Civic OS** from local kinematic extrapolation to a production-grade **Physics-Informed Neural Network (PINN) & Multi-Input LSTM Deep Learning Engine**. 

By fusing live ESP32 IoT telemetry with upstream river gauging stations, Doppler rainfall radar, and soil moisture saturation indices, NADI will provide highly accurate, physically consistent flood forecasts up to **24 hours in advance** for Sungai Kelantan and high-risk river basins across Malaysia.

---

## 🏗️ 1. Multi-Input Data Ingestion Architecture

The PINN engine integrates 4 primary data streams into a normalized 3D tensor shape `(batch_size, sequence_length=24, num_features=8)` representing a 24-hour rolling historical window.

| Input Feature | Data Source | Sampling Interval | Physical Unit | Significance |
| :--- | :--- | :--- | :--- | :--- |
| **Live Sonar Water Level ($h$)** | Local ESP32 LoRaWAN Node | 5 seconds / 1 min | Meters ($\text{m}$) | Primary downstream response variable |
| **Rate of Water Level Change ($\frac{dh}{dt}$)** | Derived from ESP32 Telemetry | 1 min | $\text{cm/hr}$ | Wave surge velocity vector |
| **Upstream Gauge Telemetry ($H_{\text{upstream}}$)** | JPS InfoBanjir API (Guillemard, Dabong) | 15 mins | Meters ($\text{MSL}$) | Upstream flood wave arrival signal |
| **Doppler Rainfall Intensity ($R$)** | MET Malaysia / Open-Meteo Radar | 10 mins | $\text{mm/hr}$ | Direct precipitative runoff input |
| **Accumulated 6h Rainfall ($\sum R_{6h}$)** | Accumulated Radar Vectors | 1 hour | $\text{mm}$ | Catchment basin volume accumulation |
| **Soil Moisture Saturation ($\theta$)** | Copernicus ERA5 / Open-Meteo | 1 hour | $\text{m}^3/\text{m}^3$ | Runoff coefficient calculation ($C$) |
| **Barometric Pressure ($P_{\text{atm}}$)** | BME280 / Weather API | 10 mins | $\text{hPa}$ | Atmospheric storm depression indicator |
| **Ambient Air Temperature ($T$)** | BME280 / Weather API | 10 mins | $^{\circ}\text{C}$ | Sonar speed-of-sound calibration |

```
                              ┌─────────────────────────────────────────┐
                              │     MULTI-INPUT DATA PIPELINE           │
                              └────────────────────┬────────────────────┘
                                                   │
     ┌──────────────────────┬──────────────────────┼──────────────────────┬──────────────────────┐
     ▼                      ▼                      ▼                      ▼                      ▼
┌─────────┐            ┌─────────┐            ┌─────────┐            ┌─────────┐            ┌─────────┐
│ ESP32   │            │ JPS     │            │ Doppler │            │ Soil    │            │ BME280  │
│ Sonar   │            │ Upstream│            │ Radar   │            │ Moisture│            │ Weather │
└────┬────┘            └────┬────┘            └────┬────┘            └────┬────┘            └────┬────┘
     │                      │                      │                      │                      │
     └──────────────────────┴──────────────────────┼──────────────────────┴──────────────────────┘
                                                   │
                                                   ▼
                                 ┌───────────────────────────────────┐
                                 │ Feature Normalization & Resampling│
                                 │ Tensor: (N, 24-Step Lookback, 8)  │
                                 └─────────────────┬─────────────────┘
                                                   │
                                                   ▼
                                 ┌───────────────────────────────────┐
                                 │ PINN / LSTM Deep Learning Model   │
                                 └───────────────────────────────────┘
```

---

## 🧮 2. Physics-Informed Neural Network (PINN) Mathematics

Standard black-box neural networks often generate unphysical predictions (e.g. negative water heights or unnatural instantaneous spikes). NADI's PINN enforces physical conservation laws directly within the model's loss function.

### A. The Loss Function Architecture
The total training loss $\mathcal{L}_{\text{total}}$ is a composite of supervised data loss ($\mathcal{L}_{\text{data}}$) and physical conservation residual loss ($\mathcal{L}_{\text{physics}}$):

$$\mathcal{L}_{\text{total}} = \mathcal{L}_{\text{data}} + \lambda_{\text{phys}} \cdot \mathcal{L}_{\text{Saint-Venant}}$$

Where $\lambda_{\text{phys}} = 0.15$ is a dynamic regularization parameter.

---

### B. Supervised Data Loss ($\mathcal{L}_{\text{data}}$)
Measures the Mean Squared Error (MSE) between actual measured river levels ($h_i$) and model predictions ($\hat{h}_i$):

$$\mathcal{L}_{\text{data}} = \frac{1}{N} \sum_{i=1}^{N} \left( h_i - \hat{h}_i \right)^2$$

---

### C. 1D Saint-Venant Shallow Water Conservation Loss ($\mathcal{L}_{\text{Saint-Venant}}$)
Enforces the fundamental hydrodynamic equations for open channel flow in river basins:

1. **Continuity Equation (Mass Conservation):**
   $$\frac{\partial A}{\partial t} + \frac{\partial Q}{\partial x} - q_{in} = 0$$
   *Where $A$ is channel cross-sectional area, $Q$ is discharge rate, and $q_{in}$ is lateral rainfall runoff inflow.*

2. **Momentum Equation (Energy Conservation):**
   $$\frac{\partial Q}{\partial t} + \frac{\partial \left( \frac{Q^2}{A} \right)}{\partial x} + g A \frac{\partial h}{\partial x} + g A (S_f - S_0) = 0$$
   *Where $g$ is gravity ($9.81\text{ m/s}^2$), $S_0$ is bed slope, and $S_f$ is Manning's friction slope ($\frac{n^2 Q |Q|}{A^2 R^{4/3}}$).*

By computing automatic differentiation ($\frac{\partial \hat{h}}{\partial t}$, $\frac{\partial \hat{h}}{\partial x}$) via PyTorch / JAX autograd, predictions that violate conservation of mass or energy are heavily penalized.

---

## 💻 3. Deep Learning Network Architecture

```
Input Tensor (batch, 24, 8) 
      │
      ▼
┌───────────────────────────┐
│ Bidirectional LSTM (128)  │ ──► Extracts temporal trend dependencies
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ Spatial Conv1D Layer (64) │ ──► Extracts spatial rainfall propagation
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ Dense Physics Layer (64)  │ ──► Autograd Saint-Venant Loss Calculation
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ Linear Output Head (6, 12)│ ──► Forecast Horizons: 30m, 1h, 3h, 6h, 12h, 24h
└───────────────────────────┘
```

---

## ⚡ 4. High-Performance Serving Infrastructure

To ensure sub-50ms inference times on low-power servers or edge gateways, the trained PyTorch model will be exported to **ONNX (Open Neural Network Exchange)** format and served natively inside Next.js or a lightweight Python FastAPI microservice.

```
┌───────────────────────────────┐
│ Trained PyTorch PINN Model    │
└───────────────┬───────────────┘
                │ Export
                ▼
┌───────────────────────────────┐
│ ONNX Runtime Engine (.onnx)   │ ──► CPU / TensorRT Acceleration
└───────────────┬───────────────┘
                │ REST API / WebSocket
                ▼
┌───────────────────────────────┐
│ Next.js NADI API Route        │
│ (/api/bencana/sensors/predict)│
└───────────────┬───────────────┘
                │ JSON Response
                ▼
┌───────────────────────────────┐
│ Web Dashboard / Citizen Alert │
└───────────────────────────────┘
```

---

## 🗓️ 5. Phased Implementation Roadmap

### Phase 1: Data Pipelines & Historical Ingestion (Weeks 1–3)
- [ ] Connect JPS InfoBanjir API to fetch Guillemard & Dabong upstream gauge telemetry.
- [ ] Integrate Open-Meteo / MET Malaysia API for rainfall radar & soil moisture.
- [ ] Store historical time-series in Supabase / TimescaleDB.

### Phase 2: PINN Model Training & PyTorch Validation (Weeks 4–6)
- [ ] Construct PyTorch dataset pipelines for 24h sequence lookbacks.
- [ ] Implement Saint-Venant loss regularizer ($\mathcal{L}_{\text{Saint-Venant}}$).
- [ ] Train on 2014 & 2023 Kelantan historic flood dataset.
- [ ] Benchmark RMSE, MAE, and Nash-Sutcliffe Efficiency (NSE > 0.90 target).

### Phase 3: ONNX Microservice & Next.js Integration (Weeks 7–8)
- [ ] Export trained model to `nadi_pinn_v1.onnx`.
- [ ] Integrate ONNX Runtime Web / Server into `/api/bencana/sensors/predict`.
- [ ] Connect predictive output directly to `SensorTrendChart.tsx` for real-time display.

### Phase 4: Field Validation & Automated Evacuation Dispatch (Weeks 9–10)
- [ ] Field-test with live ESP32 telemetry hardware node.
- [ ] Trigger automated Telegram / WhatsApp emergency alerts to citizens when PINN predicts $h > 120\text{ cm}$ 6 hours in advance.

---

*NADI Civic OS Architecture Specification — Designed for Resilient Disaster Management.*
