"""Dumas-Wolf configuration and numerical orchestration."""
from time import perf_counter
from backend.polynomial import Polynomial
from .metric import MetricSettings, solve_metric
from .transport import TransportSettings, integrate_rays


def describe(polynomial: Polynomial) -> dict:
    return {'model':'dumas-wolf', 'degree':polynomial.degree,
        'roots':[[z.real,z.imag] for z in polynomial.roots], 'leading_coefficient':1,
        'expected_vertices':polynomial.degree+3,
        'equation':'Delta w = 2 exp(w) - 4 |q|^2 exp(-2w)',
        'metric':'exp(w)|dz|^2', 'status':'ready', 'solver_available':True}


def solve(polynomial: Polynomial,metric_settings: MetricSettings,
          transport_settings: TransportSettings,progress=None,initial=None):
    started = perf_counter()
    if polynomial.degree > 8:
        raise ValueError('This initial numerical version supports degrees 0-8.')
    metric = solve_metric(polynomial,metric_settings,progress,initial)
    transport = integrate_rays(polynomial,metric,transport_settings,progress)
    result = {'polynomial':describe(polynomial), 'metric':metric.to_json(),
        'transport':transport, 'elapsed_seconds':perf_counter()-started,
        'settings':{'radius':metric_settings.radius, 'grid_size':metric_settings.grid_size,
                    'cutoff':transport_settings.cutoff, 'ray_count':transport_settings.ray_count,
                    'metric_relative_tolerance':metric_settings.residual_tolerance,
                    'transport_relative_tolerance':transport_settings.relative_tolerance,
                    'radial_samples':transport_settings.sample_count},
        'source':'https://arxiv.org/abs/1407.8149v3',
        'normalization':'Monic Pick coefficient q; real orthonormal affine frame E(0)=I'}
    return result,metric
