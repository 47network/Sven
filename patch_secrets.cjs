const { execSync } = require('child_process');

try {
  // Update detect-secrets baseline based on CI instructions
  execSync('python -m pip install --disable-pip-version-check detect-secrets==1.5.0');
  execSync(`detect-secrets scan \\
    apps \\
    services \\
    packages \\
    scripts \\
    .github \\
    docs/release \\
    docs/parity \\
    docs/Sven_Master_Checklist.md \\
    docs/SVEN_APP_CHECKLIST.md \\
    --exclude-files '(^|/)pnpm-lock\\.yaml$|(^|/)(dist|vendor)/|(^|/)\\.detect-secrets\\.cfg$|(^|/)ci-gates\\.json$' \\
    > .secrets.baseline`);
  execSync(`jq 'del(.generated_at)' .secrets.baseline > .secrets.baseline.stripped && mv .secrets.baseline.stripped .secrets.baseline`);
  console.log('Secrets baseline updated successfully');
} catch (e) {
  console.error('Failed:', e);
}
