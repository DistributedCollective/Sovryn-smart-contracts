"""Regression checks for the local Brownie hidden-directory importer patch."""

import importlib
from pathlib import Path
import sys
import tempfile
import unittest

from brownie.project.scripts import _import_from_path


class BrownieScriptImportTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="brownie-import-")
        self.addCleanup(self.directory.cleanup)
        sys.path.insert(0, Path(self.directory.name).anchor)
        self.addCleanup(sys.path.remove, Path(self.directory.name).anchor)

    def make_script(self, project_name, value, hidden=True):
        parent = Path(self.directory.name).resolve()
        root = parent / ".worktrees" / project_name if hidden else parent / project_name
        root.mkdir(parents=True)
        (root / "brownie-config.yaml").write_text("{}\n")
        (root / "contracts").mkdir()
        (root / "tests").mkdir()
        scripts = root / "scripts"
        scripts.mkdir()
        (scripts / "helper.py").write_text(f"VALUE = {value}\n")
        script = scripts / "probe.py"
        script.write_text("from .helper import VALUE\ndef main():\n    return VALUE\n")
        return script

    def test_imports_hidden_worktree_script_and_relative_dependency(self):
        script = self.make_script("first-project", 42)
        module = _import_from_path(script)
        self.assertEqual(module.main(), 42)
        self.assertEqual(Path(module.__file__), script)

    def test_preserves_ordinary_project_imports(self):
        module = _import_from_path(
            self.make_script("ordinary-project", 42, hidden=False)
        )
        self.assertEqual(module.main(), 42)

    def test_identical_relative_paths_in_different_projects_remain_isolated(self):
        first = _import_from_path(self.make_script("first-project", 42))
        second = _import_from_path(self.make_script("second-project", 73))
        self.assertEqual(first.main(), 42)
        self.assertEqual(second.main(), 73)
        self.assertNotEqual(first.__name__, second.__name__)

    def test_reloads_updated_script(self):
        script = self.make_script("first-project", 42)
        first = _import_from_path(script)
        script.write_text("def main():\n    return 123456\n")
        importlib.invalidate_caches()
        second = _import_from_path(script)
        self.assertIs(first, second)
        self.assertEqual(second.main(), 123456)


if __name__ == "__main__":
    unittest.main()
