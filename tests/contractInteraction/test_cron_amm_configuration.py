import ast
from pathlib import Path
import unittest

from scripts.contractInteraction.cron_funding import (
    AMM_FIRST_BATCH_GAS_LIMIT,
    AMM_SECOND_BATCH_GAS_LIMIT,
    AMM_USDT0_GAS_LIMIT,
)


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _function_tree(relative_path, function_name):
    tree = ast.parse((PROJECT_ROOT / relative_path).read_text())
    return next(
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == function_name
    )


def _name_set(node):
    return {child.id for child in ast.walk(node) if isinstance(child, ast.Name)}


class AmmCronConfigurationTest(unittest.TestCase):
    def test_gas_limits_preserve_measured_headroom(self):
        self.assertEqual(AMM_FIRST_BATCH_GAS_LIMIT, 2_500_000)
        self.assertEqual(AMM_SECOND_BATCH_GAS_LIMIT, 1_500_000)
        self.assertEqual(AMM_USDT0_GAS_LIMIT, 750_000)

    def test_converter_batches_and_gas_limits_are_pinned(self):
        function = _function_tree(
            "scripts/contractInteraction/protocol.py", "withdrawFeesAMM"
        )
        calls = [
            node
            for node in ast.walk(function)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "withdrawFeesAMM"
        ]

        actual = []
        for call in calls:
            converters = [element.slice.value for element in call.args[0].elts]
            transaction = call.args[1]
            gas_limit = next(
                value.id
                for key, value in zip(transaction.keys, transaction.values)
                if key.value == "gas_limit"
            )
            actual.append((converters, gas_limit))

        self.assertEqual(
            actual,
            [
                (
                    [
                        "ConverterSOV",
                        "ConverterXUSD",
                        "ConverterETHs",
                        "ConverterMOC",
                        "ConverterBNBs",
                        "ConverterFISH",
                    ],
                    "AMM_FIRST_BATCH_GAS_LIMIT",
                ),
                (
                    [
                        "ConverterRIF",
                        "ConverterMYNT",
                        "ConverterDLLR",
                        "ConverterPOWA",
                        "ConverterBOS",
                    ],
                    "AMM_SECOND_BATCH_GAS_LIMIT",
                ),
                (["ConverterUSDT0"], "AMM_USDT0_GAS_LIMIT"),
            ],
        )

    def test_funding_check_covers_all_three_batches(self):
        function = _function_tree(
            "scripts/contractInteraction/rewards_cron_amm.py", "main"
        )
        call = next(
            node
            for node in ast.walk(function)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "check_signer_funding"
        )

        self.assertEqual(
            _name_set(call.args[2]),
            {
                "AMM_FIRST_BATCH_GAS_LIMIT",
                "AMM_SECOND_BATCH_GAS_LIMIT",
                "AMM_USDT0_GAS_LIMIT",
            },
        )


if __name__ == "__main__":
    unittest.main()
