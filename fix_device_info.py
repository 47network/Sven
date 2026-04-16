import os

pubspec_path = 'apps/companion-user-flutter/pubspec.yaml'
if os.path.exists(pubspec_path):
    with open(pubspec_path, 'r') as f:
        content = f.read()
    new_content = content.replace('device_info_plus: ^12.0.0', 'device_info_plus: ^13.0.0')
    with open(pubspec_path, 'w') as f:
        f.write(new_content)

podfile_path = 'apps/companion-user-flutter/ios/Podfile'
if os.path.exists(podfile_path):
    with open(podfile_path, 'r') as f:
        lines = f.readlines()
    new_lines = []
    for line in lines:
        if "platform :ios," in line:
            new_lines.append("platform :ios, '14.0'\n")
        else:
            new_lines.append(line)
    with open(podfile_path, 'w') as f:
        f.writelines(new_lines)
else:
    # If Podfile doesn't exist yet, we might need to wait for flutter to generate it or create one.
    # But usually it should exist if we are building.
    pass
