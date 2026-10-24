"""A nonzero monic polynomial, represented by its roots with multiplicity."""

from dataclasses import dataclass
from math import isfinite


@dataclass(frozen=True)
class Polynomial:
    roots: tuple[complex, ...] = ()

    def __post_init__(self):
        if any(not (isfinite(z.real) and isfinite(z.imag)) for z in self.roots):
            raise ValueError("Roots must have finite real and imaginary parts.")

    @property
    def degree(self) -> int:
        return len(self.roots)

    def evaluate(self, z: complex) -> complex:
        value = 0*z + (1 + 0j)
        for root in self.roots:
            value *= z - root
        return value

    @classmethod
    def from_json(cls, payload: dict):
        roots = payload.get("roots", [])
        if not isinstance(roots, list):
            raise ValueError("roots must be a list of [real, imaginary] pairs.")
        if any(not isinstance(r, list) or len(r) != 2 for r in roots):
            raise ValueError("Each root must be [real, imaginary].")
        return cls(tuple(complex(float(r[0]), float(r[1])) for r in roots))
