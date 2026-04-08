// src/panels/SettingsPanel.tsx
import { useState } from 'react';
import { Link2, RefreshCw, LogOut, Smartphone, Search } from 'lucide-react';
import { PanelHeader } from '../components/PanelHeader';
import { AccountSwitcher } from '../components/AccountSwitcher';
import type { DesktopConfig, SavedAccount } from '../lib/api';
import { discoverServer } from '../lib/api';

interface SettingsPanelProps {
    config: DesktopConfig;
    token: string;
    deviceCode: string;
    verifyUrl: string;
    deviceBusy: boolean;
    savedAccounts: SavedAccount[];
    onConfigChange: (config: DesktopConfig) => void;
    onSaveConfig: () => void;
    onDeviceLogin: () => void;
    onRefreshSession: () => void;
    onSignOut: () => void;
    onKeepSignedIn: (pin?: string) => Promise<void>;
    onSwitchAccount: (userId: string, pin?: string) => Promise<void>;
    onUnlinkAccount: (userId: string) => Promise<void>;
}

export function SettingsPanel({
    config,
    token,
    deviceCode,
    verifyUrl,
    deviceBusy,
    savedAccounts,
    onConfigChange,
    onSaveConfig,
    onDeviceLogin,
    onRefreshSession,
    onSignOut,
    onKeepSignedIn,
    onSwitchAccount,
    onUnlinkAccount,
}: SettingsPanelProps) {
    const [saved, setSaved] = useState(false);
    const [discovering, setDiscovering] = useState(false);
    const [discoveryError, setDiscoveryError] = useState<string | null>(null);
    const [discoverySuccess, setDiscoverySuccess] = useState<string | null>(null);

    async function handleSave() {
        onSaveConfig();
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    }

    async function handleDiscover() {
        const input = config.gateway_url.trim();
        if (!input) return;
        setDiscovering(true);
        setDiscoveryError(null);
        setDiscoverySuccess(null);
        try {
            const result = await discoverServer(input);
            onConfigChange({ ...config, gateway_url: result.gatewayUrl });
            const label = result.instanceName
                ? `${result.instanceName}${result.version ? ` v${result.version}` : ''}`
                : result.gatewayUrl;
            setDiscoverySuccess(`Connected to ${label}`);
        } catch (err) {
            setDiscoveryError(err instanceof Error ? err.message : String(err));
        } finally {
            setDiscovering(false);
        }
    }

    return (
        <div className="panel">
            <PanelHeader title="Settings" subtitle="Gateway connection, authentication, and preferences" />

            {/* Connection */}
            <section className="settings-section">
                <h3 className="settings-section-title">
                    <Link2 size={14} /> Connection
                </h3>
                <div className="field">
                    <label className="field-label">Gateway URL</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                            className="field-input"
                            style={{ flex: 1 }}
                            value={config.gateway_url}
                            onChange={(e) => {
                                onConfigChange({ ...config, gateway_url: e.target.value });
                                setDiscoveryError(null);
                                setDiscoverySuccess(null);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleDiscover(); }}
                            placeholder="sven.systems or https://app.sven.systems"
                        />
                        <button
                            className="btn-secondary"
                            onClick={handleDiscover}
                            disabled={discovering}
                            title="Auto-discover Sven server"
                            style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}
                        >
                            {discovering ? (
                                <><RefreshCw size={14} className="spin" /> Discovering…</>
                            ) : (
                                <><Search size={14} /> Discover</>
                            )}
                        </button>
                    </div>
                    <p className="field-hint" style={{ marginTop: '4px', fontSize: '11px', opacity: 0.55 }}>
                        Enter a domain or URL — auto-discovery finds the gateway via .well-known
                    </p>
                    {discoveryError && (
                        <p className="field-hint" style={{ marginTop: '4px', fontSize: '11px', color: 'var(--danger, #e53e3e)' }}>
                            {discoveryError}
                        </p>
                    )}
                    {discoverySuccess && (
                        <p className="field-hint" style={{ marginTop: '4px', fontSize: '11px', color: 'var(--success, #38a169)' }}>
                            ✓ {discoverySuccess}
                        </p>
                    )}
                </div>
                <div className="field">
                    <label className="field-label">Chat ID</label>
                    <input
                        className="field-input"
                        value={config.chat_id}
                        onChange={(e) => onConfigChange({ ...config, chat_id: e.target.value })}
                        placeholder="Paste a chat thread ID"
                    />
                </div>
                <div className="field-row">
                    <label className="toggle-label">
                        <input
                            type="checkbox"
                            className="toggle-checkbox"
                            checked={config.polling_enabled}
                            onChange={(e) => onConfigChange({ ...config, polling_enabled: e.target.checked })}
                        />
                        <span className="toggle-track" />
                        <span className="field-label" style={{ marginBottom: 0 }}>Auto-poll approvals every 5s</span>
                    </label>
                </div>
                <button className="btn-primary" onClick={handleSave}>
                    {saved ? '✓ Saved' : 'Save Changes'}
                </button>
            </section>

            {/* Authentication */}
            <section className="settings-section">
                <h3 className="settings-section-title">
                    <Smartphone size={14} /> Authentication
                </h3>

                {token ? (
                    <div className="auth-status-card">
                        <div className="auth-status-dot online" />
                        <div>
                            <p className="auth-status-label">Session active</p>
                            <p className="auth-status-hint">Token stored in OS keyring.</p>
                        </div>
                    </div>
                ) : (
                    <div className="auth-status-card warn">
                        <div className="auth-status-dot warn" />
                        <div>
                            <p className="auth-status-label">Not signed in</p>
                            <p className="auth-status-hint">Use device login to authenticate.</p>
                        </div>
                    </div>
                )}

                {deviceCode && (
                    <div className="device-code-card">
                        <p className="device-code-label">Your one-time code</p>
                        <p className="device-code-value">{deviceCode}</p>
                        {verifyUrl && (
                            <p className="device-code-url">{verifyUrl}</p>
                        )}
                    </div>
                )}

                <div className="auth-actions">
                    <button
                        className="btn-primary"
                        onClick={onDeviceLogin}
                        disabled={deviceBusy}
                    >
                        {deviceBusy ? (
                            <><RefreshCw size={14} className="spin" /> Authorizing…</>
                        ) : (
                            <><Smartphone size={14} /> Start Device Login</>
                        )}
                    </button>
                    {token && (
                        <>
                            <button className="btn-secondary" onClick={onRefreshSession}>
                                <RefreshCw size={14} /> Rotate Session
                            </button>
                            <button className="btn-danger" onClick={onSignOut}>
                                <LogOut size={14} /> Sign Out
                            </button>
                        </>
                    )}
                </div>
            </section>

            {/* Multi-Account */}
            <section className="settings-section">
                <AccountSwitcher
                    accounts={savedAccounts}
                    token={token}
                    onKeepSignedIn={onKeepSignedIn}
                    onSwitchAccount={onSwitchAccount}
                    onUnlinkAccount={onUnlinkAccount}
                />
            </section>
        </div>
    );
}
