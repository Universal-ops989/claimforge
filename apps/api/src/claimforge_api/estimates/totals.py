"""An estimate's totals: subtotal, sales tax, overhead and profit.

In the order estimating software applies them: tax on the taxable lines, then overhead
and profit on the subtotal plus tax. Every amount is rounded half up to the cent and the
total is the sum of the rounded amounts, so the figures on a printed estimate add up.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
HUNDRED = Decimal(100)


def cents(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def percent_of(amount: Decimal, percent: Decimal) -> Decimal:
    return cents(amount * percent / HUNDRED)


@dataclass(frozen=True)
class Line:
    total: Decimal
    taxable: bool


@dataclass(frozen=True)
class Totals:
    subtotal: Decimal
    taxable_subtotal: Decimal
    tax: Decimal
    overhead: Decimal
    profit: Decimal
    total: Decimal


def totals(
    lines: Iterable[Line],
    *,
    tax_percent: Decimal,
    overhead_percent: Decimal,
    profit_percent: Decimal,
) -> Totals:
    items = list(lines)
    subtotal = sum((line.total for line in items), Decimal("0.00"))
    taxable = sum((line.total for line in items if line.taxable), Decimal("0.00"))
    tax = percent_of(taxable, tax_percent)
    base = subtotal + tax
    overhead = percent_of(base, overhead_percent)
    profit = percent_of(base, profit_percent)
    return Totals(
        subtotal=cents(subtotal),
        taxable_subtotal=cents(taxable),
        tax=tax,
        overhead=overhead,
        profit=profit,
        total=cents(subtotal + tax + overhead + profit),
    )
