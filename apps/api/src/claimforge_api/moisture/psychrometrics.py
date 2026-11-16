"""How much water the air holds, from temperature and relative humidity.

Relative humidity alone misleads: 50% at 90°F holds far more water than 50% at 60°F.
Restorers compare **grains per pound** (GPP: grains of water vapour per pound of dry air;
7000 grains to the pound) between outdoors, the affected area, an unaffected area and each
dehumidifier's exhaust, and the **dew point**, below which surfaces sweat.

GPP uses the Hyland-Wexler saturation pressure over water and the humidity ratio from
ASHRAE Fundamentals (what psychrometric charts are drawn from). The dew point inverts the
Magnus formula, which matches the charts to a tenth of a degree over drying conditions.
Air pressure is taken at sea level: at 1000 ft GPP reads about 4% low, at 5000 ft about
20%, the same for every reading on a job, so comparisons between them hold.
"""

import math
from decimal import ROUND_HALF_UP, Decimal

SEA_LEVEL_HPA = 1013.25
#: Molar mass of water over that of dry air (ASHRAE).
_EPSILON = 0.621945
#: Hyland-Wexler coefficients for ln(saturation pressure in Pa) over water, T in kelvin.
_HW = (-5.8002206e3, 1.3914993, -4.8640239e-2, 4.1764768e-5, -1.4452093e-8, 6.5459673)
_GRAINS_PER_POUND = 7000
_A, _B = 17.625, 243.04  # Magnus coefficients (°C)
_TENTH = Decimal("0.1")


def _celsius(fahrenheit: float) -> float:
    return (fahrenheit - 32) * 5 / 9


def _saturation_hpa(celsius: float) -> float:
    """Hyland-Wexler, over liquid water."""
    t = celsius + 273.15
    c8, c9, c10, c11, c12, c13 = _HW
    pascals = math.exp(c8 / t + c9 + c10 * t + c11 * t**2 + c12 * t**3 + c13 * math.log(t))
    return pascals / 100


def _tenth(value: float) -> Decimal:
    return Decimal(str(value)).quantize(_TENTH, rounding=ROUND_HALF_UP)


def grains_per_pound(
    temperature_f: Decimal, relative_humidity: Decimal, *, pressure_hpa: float = SEA_LEVEL_HPA
) -> Decimal:
    """Grains of water per pound of dry air, to a tenth."""
    vapour = float(relative_humidity) / 100 * _saturation_hpa(_celsius(float(temperature_f)))
    humidity_ratio = _EPSILON * vapour / (pressure_hpa - vapour)
    return _tenth(humidity_ratio * _GRAINS_PER_POUND)


def dew_point_f(temperature_f: Decimal, relative_humidity: Decimal) -> Decimal:
    """The temperature at which this air would condense, in °F, to a tenth."""
    if relative_humidity <= 0:
        raise ValueError("Bone-dry air has no dew point")
    celsius = _celsius(float(temperature_f))
    gamma = math.log(float(relative_humidity) / 100) + _A * celsius / (_B + celsius)
    dew_c = _B * gamma / (_A - gamma)
    return _tenth(dew_c * 9 / 5 + 32)
