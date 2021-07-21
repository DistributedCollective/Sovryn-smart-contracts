# Tests Common issues

# Rounding

- Python scientific notation uses floating-point. So it can produce wrong numbers. If you need a number grater than 1e22 use `**` operator. Ex: 10\*\*50.

```bash
>>> int(1e22)
10000000000000000000000L
>>> int(1e23)
99999999999999991611392L
>>> int(10**23)
100000000000000000000000L
```

- If you need to do calculations with integers like division use `fixedint` class helper. `tests/fixedint.py`

# Time travel

To change block timestamp in the chain use brownie `chain` fixture and do:

```python
chain.sleep(number_of_seconds)
chain.mine(1)  # mine one block, You can only modify the next block timestamp.
```
