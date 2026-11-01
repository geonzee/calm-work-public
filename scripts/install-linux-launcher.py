#!/usr/bin/env python3
"""Install the Calm Work launcher, desktop entry and icon without touching the user's other applications."""
from pathlib import Path
import argparse
import shlex
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--prefix", type=Path, default=Path.home(), help="User home or isolated verification prefix")
home = parser.parse_args().prefix.resolve()
launcher = home / '.local/bin/calm-work-public'
applications = home / '.local/share/applications'
icons = home / '.local/share/icons/hicolor/scalable/apps'
for directory in [launcher.parent, applications, icons]:
    directory.mkdir(parents=True, exist_ok=True)
# The launcher runs the installed copy (scripts/install-app.sh) with the stable
# profile in ~/.local/share/calm-work-public, so rebuilding this checkout never changes the daily app.
shutil.copyfile(root / 'apps/desktop/linux/calm-work-launcher.sh', launcher)
launcher.chmod(0o755)
shutil.copyfile(root / 'apps/desktop/linux/calm-work.svg', icons / 'calm-work-public.svg')
# Desktop Exec quoting has its own rules, distinct from shell quoting.
quoted = '"' + str(launcher).replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$') + '"'
entry = applications / 'calm-work-public.desktop'
entry.write_text('[Desktop Entry]\nType=Application\nName=Calm Work Public\nGenericName=Tasks and time tracking\nComment=Local-first tasks, planning and time tracking\nExec=' + quoted + ' %U\nIcon=calm-work-public\nTerminal=false\nCategories=Office;ProjectManagement;\nStartupWMClass=calm-work\n')
subprocess.run(['desktop-file-validate', str(entry)], check=True)
if shutil.which('update-desktop-database'):
    subprocess.run(['update-desktop-database', str(applications)], check=True)
print('Installed Calm Work launcher and icon; its native tray appears when launched.')
