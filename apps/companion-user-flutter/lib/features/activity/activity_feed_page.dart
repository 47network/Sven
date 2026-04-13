import 'package:flutter/material.dart';

import '../../app/sven_tokens.dart';
import '../../app/app_models.dart';
import 'activity_feed_service.dart';

class ActivityFeedPage extends StatefulWidget {
  const ActivityFeedPage({
    super.key,
    required this.service,
    required this.visualMode,
  });

  final ActivityFeedService service;
  final VisualMode visualMode;

  @override
  State<ActivityFeedPage> createState() => _ActivityFeedPageState();
}

class _ActivityFeedPageState extends State<ActivityFeedPage> {
  final List<Map<String, dynamic>> _events = [];
  int _unreadCount = 0;
  bool _loading = true;
  bool _hasMore = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({String? before}) async {
    try {
      final data = await widget.service.getEvents(before: before);
      final events = (data['events'] as List<dynamic>?)
              ?.cast<Map<String, dynamic>>() ??
          [];
      setState(() {
        if (before == null) _events.clear();
        _events.addAll(events);
        _unreadCount = (data['unread_count'] as int?) ?? 0;
        _hasMore = (data['has_more'] as bool?) ?? false;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _markAllRead() async {
    await widget.service.markRead(all: true);
    setState(() {
      _unreadCount = 0;
      for (final e in _events) {
        e['read'] = true;
      }
    });
  }

  IconData _iconFor(String eventType) {
    switch (eventType) {
      case 'chat_created':
        return Icons.chat_bubble_outline_rounded;
      case 'chat_message':
        return Icons.message_outlined;
      case 'agent_run':
        return Icons.smart_toy_outlined;
      case 'memory_update':
        return Icons.psychology_outlined;
      case 'approval_request':
        return Icons.approval_outlined;
      case 'approval_resolved':
        return Icons.check_circle_outline_rounded;
      case 'org_invite':
        return Icons.group_add_outlined;
      case 'login':
        return Icons.login_rounded;
      case 'setting_change':
        return Icons.settings_outlined;
      default:
        return Icons.notifications_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text('Activity',
            style: TextStyle(color: tokens.onSurface, fontWeight: FontWeight.w600)),
        iconTheme: IconThemeData(color: tokens.onSurface),
        actions: [
          if (_unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: Text('Mark all read',
                  style: TextStyle(color: tokens.primary, fontSize: 13)),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _events.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.inbox_outlined,
                          size: 48, color: tokens.onSurface.withValues(alpha: 0.3)),
                      const SizedBox(height: 12),
                      Text('No activity yet',
                          style: TextStyle(
                            color: tokens.onSurface.withValues(alpha: 0.5),
                          )),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => _load(),
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: _events.length + (_hasMore ? 1 : 0),
                    itemBuilder: (context, i) {
                      if (i == _events.length) {
                        // Load more trigger
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          child: Center(
                            child: TextButton(
                              onPressed: () {
                                final last = _events.last['created_at'] as String?;
                                _load(before: last);
                              },
                              child: Text('Load more',
                                  style: TextStyle(color: tokens.primary)),
                            ),
                          ),
                        );
                      }

                      final event = _events[i];
                      final type = event['event_type'] as String? ?? '';
                      final title = event['title'] as String? ?? '';
                      final body = event['body'] as String?;
                      final read = event['read'] as bool? ?? false;
                      final createdAt = event['created_at'] as String? ?? '';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: read
                              ? (cinematic
                                  ? Colors.white.withValues(alpha: 0.03)
                                  : Colors.white)
                              : tokens.primary.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: read
                                ? tokens.frame.withValues(alpha: 0.2)
                                : tokens.primary.withValues(alpha: 0.25),
                          ),
                        ),
                        child: ListTile(
                          leading: Icon(
                            _iconFor(type),
                            color: read
                                ? tokens.onSurface.withValues(alpha: 0.4)
                                : tokens.primary,
                            size: 22,
                          ),
                          title: Text(
                            title,
                            style: TextStyle(
                              color: tokens.onSurface,
                              fontWeight: read ? FontWeight.w400 : FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          subtitle: body != null
                              ? Text(
                                  body,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: tokens.onSurface.withValues(alpha: 0.55),
                                    fontSize: 12,
                                  ),
                                )
                              : null,
                          trailing: Text(
                            _formatTime(createdAt),
                            style: TextStyle(
                              color: tokens.onSurface.withValues(alpha: 0.4),
                              fontSize: 11,
                            ),
                          ),
                          onTap: () {
                            if (!read) {
                              widget.service
                                  .markRead(ids: [event['id'] as String]);
                              setState(() {
                                event['read'] = true;
                                _unreadCount = (_unreadCount - 1).clamp(0, 999);
                              });
                            }
                          },
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  String _formatTime(String iso) {
    try {
      final dt = DateTime.parse(iso);
      final now = DateTime.now();
      final diff = now.difference(dt);
      if (diff.inMinutes < 1) return 'now';
      if (diff.inHours < 1) return '${diff.inMinutes}m';
      if (diff.inDays < 1) return '${diff.inHours}h';
      if (diff.inDays < 7) return '${diff.inDays}d';
      return '${dt.month}/${dt.day}';
    } catch (_) {
      return '';
    }
  }
}
