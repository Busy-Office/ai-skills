"""Nightly: sum the day's orders from out/orders.json for the ledger feed."""
import json
import sys


def main(path="out/orders.json"):
    with open(path) as f:
        orders = json.load(f)
    day_total = sum(order["total"] for order in orders)
    print(f"{len(orders)} orders, {day_total:.2f}")


if __name__ == "__main__":
    main(*sys.argv[1:])
