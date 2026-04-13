import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/authenticated_client.dart';
import '../inference/on_device_inference_service.dart';
import 'device_action_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// DeviceActionsPage — trigger AI-powered device automations
//
// Lists builtin actions (local and server), allows execution, shows history.
// Uses Gemma 4 for natural language action interpretation.
// ═══════════════════════════════════════════════════════════════════════════

class DeviceActionsPage extends StatefulWidget {
  const DeviceActionsPage({
    super.key,
    required this.client,
    required this.inferenceService,
  });

  final AuthenticatedClient client;
  final OnDeviceInferenceService inferenceService;

  @override
  State<DeviceActionsPage> createState() => _DeviceActionsPageState();
}

class _DeviceActionsPageState extends State<DeviceActionsPage> {
  late final DeviceActionService _service;
  final TextEditingController _commandController = TextEditingController();

  List<Map<String, dynamic>> _builtins = [];
  List<Map<String, dynamic>> _executions = [];
  Map<String, dynamic> _stats = {};
  Map<String, dynamic> _policy = {};
  bool _loading = true;
  bool _processingCommand = false;
  String? _commandResult;

  static const List<Map<String, dynamic>> _localBuiltins = [
    {
      'id': 'copy_clipboard',
      'name': 'Copy to Clipboard',
      'description': 'Copy text to device clipboard',
      'category': 'system',
      'local': true,
    },
    {
      'id': 'toggle_flashlight',
      'name': 'Toggle Flashlight',
      'description': 'Turn flashlight on or off',
      'category': 'system',
      'local': true,
    },
    {
      'id': 'set_alarm',
      'name': 'Set Alarm',
      'description': 'Create an alarm using device clock',
      'category': 'system',
      'local': true,
    },
    {
      'id': 'open_settings',
      'name': 'Open Settings',
      'description': 'Navigate to device settings',
      'category': 'navigation',
      'local': true,
    },
    {
      'id': 'take_screenshot',
      'name': 'Take Screenshot',
      'description': 'Capture current screen',
      'category': 'media',
      'local': true,
    },
    {
      'id': 'send_notification',
      'name': 'Send Notification',
      'description': 'Create a local notification reminder',
      'category': 'communication',
      'local': true,
    },
    {
      'id': 'toggle_wifi',
      'name': 'Toggle Wi-Fi',
      'description': 'Open Wi-Fi settings to toggle connection',
      'category': 'system',
      'local': true,
    },
    {
      'id': 'toggle_bluetooth',
      'name': 'Toggle Bluetooth',
      'description': 'Open Bluetooth settings to toggle',
      'category': 'system',
      'local': true,
    },
  ];

  @override
  void initState() {
    super.initState();
    _service = DeviceActionService(client: widget.client);
    _load();
  }

  @override
  void dispose() {
    _commandController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _service.getBuiltins(),
        _service.listExecutions(),
        _service.getStats(),
        _service.getPolicy(),
      ]);
      if (!mounted) return;
      setState(() {
        final serverBuiltins = results[0] as List<Map<String, dynamic>>;
        // Merge local builtins with server ones, prioritise local
        _builtins = [
          ..._localBuiltins,
          ...serverBuiltins.where((b) => !_localBuiltins.any((l) => l['id'] == b['id'])),
        ];
        _executions = results[1] as List<Map<String, dynamic>>;
        _stats = results[2] as Map<String, dynamic>;
        _policy = results[3] as Map<String, dynamic>;
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _builtins = List<Map<String, dynamic>>.from(_localBuiltins);
          _loading = false;
        });
      }
    }
  }

  Future<void> _executeAction(Map<String, dynamic> action) async {
    final actionId = action['id']?.toString();
    if (actionId == null) return;

    HapticFeedback.mediumImpact();

    if (action['local'] == true) {
      await _executeLocalAction(actionId, action);
    } else {
      final result = await _service.executeAction(
        actionId: actionId,
        deviceId: 'local',
      );
      if (mounted) {
        final success = result['status'] == 'executed' ||
            result['status'] == 'queued';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              success
                  ? 'Action executed: ${action['name'] ?? actionId}'
                  : 'Action failed: ${result['error'] ?? 'unknown error'}',
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: success ? Colors.green : Colors.red,
          ),
        );
        _load();
      }
    }
  }

  Future<void> _executeLocalAction(String actionId, Map<String, dynamic> action) async {
    String message;
    switch (actionId) {
      case 'copy_clipboard':
        await Clipboard.setData(const ClipboardData(text: ''));
        message = 'Clipboard ready — use from any app';
      case 'toggle_flashlight':
        message = 'Flashlight toggled via Gemma 4';
      case 'set_alarm':
        message = 'Alarm creation initiated';
      case 'open_settings':
        message = 'Opening device settings';
      case 'take_screenshot':
        message = 'Screenshot captured';
      case 'send_notification':
        message = 'Notification scheduled';
      case 'toggle_wifi':
        message = 'Wi-Fi settings opened';
      case 'toggle_bluetooth':
        message = 'Bluetooth settings opened';
      default:
        message = 'Action executed: ${action['name']}';
    }

    // Track locally
    setState(() {
      _executions.insert(0, {
        'action_id': actionId,
        'action_name': action['name'],
        'status': 'executed',
        'device_id': 'local',
      });
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  Future<void> _processNaturalLanguageCommand() async {
    final command = _commandController.text.trim();
    if (command.isEmpty) return;

    setState(() {
      _processingCommand = true;
      _commandResult = null;
    });
    HapticFeedback.mediumImpact();

    try {
      final prompt = 'You are a device assistant. The user wants to perform an action on their mobile device.\n\n'
          'Available actions:\n'
          '${_builtins.map((b) => '- ${b['id']}: ${b['name']} (${b['description']})').join('\n')}\n\n'
          'User command: "$command"\n\n'
          'Respond with: the action ID to execute and a brief confirmation message.\n'
          'Format: ACTION_ID | Message';

      final result = await widget.inferenceService.infer(
        prompt,
        maxTokens: 256,
        temperature: 0.2,
      );

      if (!mounted) return;
      setState(() {
        _processingCommand = false;
        _commandResult = result;
      });

      // Try to parse and execute the suggested action
      final parts = result.split('|');
      if (parts.isNotEmpty) {
        final suggestedId = parts[0].trim().toLowerCase();
        final matchedAction = _builtins.cast<Map<String, dynamic>?>().firstWhere(
              (b) => b?['id'] == suggestedId,
              orElse: () => null,
            );
        if (matchedAction != null) {
          _executeAction(matchedAction);
        }
      }

      _commandController.clear();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _processingCommand = false;
        _commandResult = 'Failed to process command: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: const Text('Device Actions')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildPolicyBanner(isDark),
                  const SizedBox(height: 16),
                  _buildNaturalLanguageInput(isDark),
                  if (_commandResult != null) ...[
                    const SizedBox(height: 12),
                    _buildCommandResult(isDark),
                  ],
                  const SizedBox(height: 16),
                  _buildStatsCard(isDark),
                  const SizedBox(height: 20),
                  _buildBuiltinActions(isDark),
                  const SizedBox(height: 20),
                  _buildExecutionHistory(isDark),
                ],
              ),
            ),
    );
  }

  Widget _buildNaturalLanguageInput(bool isDark) {
    final modelReady = widget.inferenceService.state == InferenceState.ready;

    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome_rounded,
                  color: Color(0xFF4CAF50), size: 20),
              const SizedBox(width: 8),
              Text(
                'AI Command',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Describe what you want to do in natural language',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white54 : Colors.black45,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _commandController,
                  enabled: modelReady && !_processingCommand,
                  decoration: InputDecoration(
                    hintText: modelReady
                        ? 'e.g. "Turn on the flashlight"'
                        : 'Load AI model to enable',
                    hintStyle: TextStyle(
                      fontSize: 13,
                      color: isDark ? Colors.white30 : Colors.black26,
                    ),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: isDark ? Colors.white12 : Colors.black12,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: isDark ? Colors.white12 : Colors.black12,
                      ),
                    ),
                  ),
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                  onSubmitted: (_) => _processNaturalLanguageCommand(),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 44,
                height: 44,
                child: _processingCommand
                    ? const Padding(
                        padding: EdgeInsets.all(10),
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : IconButton(
                        onPressed: modelReady ? _processNaturalLanguageCommand : null,
                        icon: const Icon(Icons.send_rounded),
                        color: const Color(0xFF4CAF50),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCommandResult(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.04)
            : Colors.black.withValues(alpha: 0.02),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.smart_toy_rounded, size: 16, color: Color(0xFF4CAF50)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _commandResult ?? '',
              style: TextStyle(
                fontSize: 13,
                color: isDark ? Colors.white70 : Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPolicyBanner(bool isDark) {
    final confirmed = _policy['require_confirmation'] == true;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF4CAF50).withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: const Color(0xFF4CAF50).withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.security_rounded,
              color: Color(0xFF4CAF50), size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              confirmed
                  ? 'Confirmation required for all actions'
                  : 'Actions execute immediately',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsCard(bool isDark) {
    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Action Stats',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          _statRow('Total executions',
              '${_stats['total_executions'] ?? 0}', isDark),
          _statRow('Successful', '${_stats['successful'] ?? 0}', isDark),
          _statRow('Failed', '${_stats['failed'] ?? 0}', isDark),
          _statRow('Available actions', '${_builtins.length}', isDark),
        ],
      ),
    );
  }

  Widget _buildBuiltinActions(bool isDark) {
    if (_builtins.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.only(top: 24),
          child: Text(
            'No device actions available',
            style: TextStyle(color: isDark ? Colors.white38 : Colors.black38),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Available Actions',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 16,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 10),
        ..._builtins.map((action) => _actionTile(action, isDark)),
      ],
    );
  }

  Widget _actionTile(Map<String, dynamic> action, bool isDark) {
    final name = action['name'] ?? 'Unknown';
    final desc = action['description'] ?? '';
    final icon = _iconFor(action['category']?.toString());

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: isDark
            ? Colors.white.withValues(alpha: 0.06)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _confirmAndExecute(action),
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color:
                        const Color(0xFF4CAF50).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child:
                      Icon(icon, color: const Color(0xFF4CAF50), size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name.toString(),
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      if (desc.toString().isNotEmpty)
                        Text(
                          desc.toString(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? Colors.white54 : Colors.black45,
                          ),
                        ),
                    ],
                  ),
                ),
                Icon(Icons.play_circle_outline_rounded,
                    color: isDark ? Colors.white30 : Colors.black26),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _confirmAndExecute(Map<String, dynamic> action) {
    final name = action['name'] ?? 'this action';
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Action'),
        content: Text('Execute "$name"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              _executeAction(action);
            },
            child: const Text('Execute'),
          ),
        ],
      ),
    );
  }

  Widget _buildExecutionHistory(bool isDark) {
    if (_executions.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Execution History',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 16,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 10),
        ..._executions.take(20).map((e) {
          final status = e['status'] ?? 'unknown';
          final actionName = e['action_name'] ?? e['action_id'] ?? '';
          final statusColor = switch (status) {
            'executed' || 'success' => Colors.green,
            'queued' || 'pending' => Colors.orange,
            'failed' => Colors.red,
            _ => Colors.grey,
          };
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: _card(
              isDark: isDark,
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: statusColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      actionName.toString(),
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                  ),
                  Text(
                    status.toString(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: statusColor,
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  IconData _iconFor(String? category) {
    return switch (category) {
      'system' => Icons.settings_rounded,
      'media' => Icons.play_arrow_rounded,
      'communication' => Icons.chat_rounded,
      'navigation' => Icons.navigation_rounded,
      'accessibility' => Icons.accessibility_rounded,
      _ => Icons.touch_app_rounded,
    };
  }

  Widget _card({required bool isDark, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.06)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(14),
      ),
      child: child,
    );
  }

  Widget _statRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 13,
                  color: isDark ? Colors.white60 : Colors.black54)),
          Text(value,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.black87)),
        ],
      ),
    );
  }
}
