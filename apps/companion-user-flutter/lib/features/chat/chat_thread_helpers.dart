part of 'chat_thread_page.dart';

// ═══════════════════════════════════════════════════════════════════════════
// Animated message entrance
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Scroll-to-bottom FAB — appears when user scrolls away from the bottom.
// Shows an unread badge when new messages arrive while scrolled up.
// ═══════════════════════════════════════════════════════════════════════════

class _ScrollToBottomFab extends StatelessWidget {
  const _ScrollToBottomFab({
    required this.unreadCount,
    required this.visualMode,
    required this.onTap,
  });

  final int unreadCount;
  final VisualMode visualMode;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;
    return Semantics(
      label: unreadCount > 0
          ? '$unreadCount new message${unreadCount == 1 ? '' : 's'}. Tap to scroll to bottom.'
          : 'Scroll to bottom',
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: cinematic
                    ? tokens.card.withValues(alpha: 0.92)
                    : tokens.surface.withValues(alpha: 0.95),
                shape: BoxShape.circle,
                border: Border.all(
                  color: cinematic
                      ? tokens.frame
                      : tokens.onSurface.withValues(alpha: 0.12),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.18),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Icon(
                Icons.keyboard_arrow_down_rounded,
                color: tokens.primary,
                size: 24,
              ),
            ),
            if (unreadCount > 0)
              Positioned(
                top: -6,
                right: -6,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: tokens.primary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    unreadCount > 99 ? '99+' : '$unreadCount',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: cinematic ? Colors.black : Colors.white,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Animated message entry (slide + fade in)
// ═══════════════════════════════════════════════════════════════════════════

class _AnimatedMessageEntry extends StatefulWidget {
  const _AnimatedMessageEntry({super.key, required this.child});
  final Widget child;

  @override
  State<_AnimatedMessageEntry> createState() => _AnimatedMessageEntryState();
}

class _AnimatedMessageEntryState extends State<_AnimatedMessageEntry>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 350),
      vsync: this,
    );
    _fadeAnim = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: widget.child,
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pinned messages bar (collapsed/expanded strip above the message list)
// ═══════════════════════════════════════════════════════════════════════════

class _PinnedMessagesBar extends StatelessWidget {
  const _PinnedMessagesBar({
    required this.pinnedMessages,
    required this.expanded,
    required this.onToggleExpand,
    required this.onScrollTo,
    required this.onUnpin,
    required this.visualMode,
  });
  final List<ChatMessage> pinnedMessages;
  final bool expanded;
  final VoidCallback onToggleExpand;
  final ValueChanged<String> onScrollTo;
  final ValueChanged<String> onUnpin;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final bg = tokens.primary.withValues(alpha: 0.07);
    final border = tokens.primary.withValues(alpha: 0.15);

    final n = pinnedMessages.length;
    final stateLabel = expanded ? 'expanded' : 'collapsed';
    return Semantics(
      label: '$n pinned message${n == 1 ? '' : 's'}, $stateLabel',
      explicitChildNodes: true,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeInOut,
        decoration: BoxDecoration(
          color: bg,
          border: Border(
            bottom: BorderSide(color: border, width: 1),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header row
            Semantics(
              button: true,
              hint: expanded
                  ? 'Collapse pinned messages'
                  : 'Expand pinned messages',
              child: InkWell(
                onTap: onToggleExpand,
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  child: Row(
                    children: [
                      ExcludeSemantics(
                        child: Icon(Icons.push_pin_rounded,
                            size: 14, color: tokens.primary),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '$n pinned',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: tokens.primary,
                        ),
                      ),
                      const Spacer(),
                      ExcludeSemantics(
                        child: Icon(
                          expanded
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          size: 18,
                          color: tokens.primary.withValues(alpha: 0.6),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            // Expanded list of pinned messages
            if (expanded)
              ...pinnedMessages.map((msg) {
                final preview = msg.text.length > 70
                    ? '${msg.text.substring(0, 67)}…'
                    : msg.text;
                return Semantics(
                  label: 'Pinned: $preview. Tap to scroll to message.',
                  button: true,
                  child: InkWell(
                    onTap: () => onScrollTo(msg.id),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 0, 6, 7),
                      child: Row(
                        children: [
                          ExcludeSemantics(
                            child: Container(
                              width: 3,
                              height: 32,
                              decoration: BoxDecoration(
                                color: tokens.primary.withValues(alpha: 0.5),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              preview,
                              style: TextStyle(
                                fontSize: 12,
                                color: tokens.onSurface.withValues(alpha: 0.7),
                                height: 1.35,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          IconButton(
                            iconSize: 16,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(
                                minWidth: 32, minHeight: 32),
                            icon: Icon(Icons.close_rounded,
                                size: 16,
                                color:
                                    tokens.onSurface.withValues(alpha: 0.35)),
                            onPressed: () => onUnpin(msg.id),
                            tooltip: 'Unpin message',
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Smart reply suggestion chips (shown after assistant responds)
// ═══════════════════════════════════════════════════════════════════════════

class _SmartReplySuggestions extends StatelessWidget {
  const _SmartReplySuggestions({
    required this.suggestions,
    required this.onTap,
    required this.visualMode,
  });
  final List<String> suggestions;
  final ValueChanged<String> onTap;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        itemCount: suggestions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final label = suggestions[index];
          return Semantics(
            label: 'Quick reply: $label',
            button: true,
            child: GestureDetector(
              onTap: () => onTap(label),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: tokens.primary.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: tokens.primary.withValues(alpha: 0.30),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ExcludeSemantics(
                      child: Icon(
                        Icons.bolt_rounded,
                        size: 14,
                        color: tokens.primary,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 12.5,
                        color: tokens.primary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Token speed badge — fades in after ~0.8s of streaming once rate stabilises
// ═══════════════════════════════════════════════════════════════════════════

class _StreamingSpeedPill extends StatelessWidget {
  const _StreamingSpeedPill({
    required this.tokensPerSec,
    required this.visualMode,
  });
  final double tokensPerSec;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final tps = tokensPerSec.round();
    return Semantics(
      label: 'Streaming at $tps tokens per second',
      child: Padding(
        padding: const EdgeInsets.only(left: 50, top: 2, bottom: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: tokens.primary.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(10),
                border:
                    Border.all(color: tokens.primary.withValues(alpha: 0.15)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ExcludeSemantics(
                    child: Icon(
                      Icons.bolt_rounded,
                      size: 10,
                      color: tokens.primary.withValues(alpha: 0.65),
                    ),
                  ),
                  const SizedBox(width: 3),
                  Text(
                    '~$tps tok/s',
                    style: TextStyle(
                      fontSize: 10,
                      color: tokens.primary.withValues(alpha: 0.65),
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Thinking indicator (three bouncing dots)
// ═══════════════════════════════════════════════════════════════════════════

class _ThinkingIndicator extends StatefulWidget {
  const _ThinkingIndicator({required this.visualMode});
  final VisualMode visualMode;

  @override
  State<_ThinkingIndicator> createState() => _ThinkingIndicatorState();
}

class _ThinkingIndicatorState extends State<_ThinkingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    return Semantics(
      liveRegion: true,
      label: 'Sven is thinking',
      child: Padding(
        padding: const EdgeInsets.only(left: 10, right: 48, top: 3, bottom: 3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _AssistantAvatar(tokens: tokens, cinematic: cinematic),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              decoration: BoxDecoration(
                color: cinematic ? tokens.card : tokens.surface,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                  bottomLeft: Radius.circular(4),
                  bottomRight: Radius.circular(20),
                ),
                border: Border.all(
                  color: cinematic
                      ? tokens.frame
                      : tokens.frame.withValues(alpha: 0.5),
                  width: 0.7,
                ),
              ),
              child: AnimatedBuilder(
                animation: _ctrl,
                builder: (context, _) {
                  return Row(
                    mainAxisSize: MainAxisSize.min,
                    children: List.generate(3, (i) {
                      final delay = i * 0.2;
                      final t = ((_ctrl.value - delay) % 1.0).clamp(0.0, 1.0);
                      final bounce = t < 0.5 ? (t * 2) : (2 - t * 2);
                      return Padding(
                        padding: EdgeInsets.only(right: i < 2 ? 4 : 0),
                        child: Transform.translate(
                          offset: Offset(0, -4 * bounce),
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: tokens.primary.withValues(
                                alpha: 0.4 + bounce * 0.5,
                              ),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      );
                    }),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}



// ═══════════════════════════════════════════════════════════════════════════
// Keyboard-aware composer wrapper
// Smoothly slides with the software keyboard using AnimatedContainer driven
// by MediaQuery.viewInsets.bottom.
// ═══════════════════════════════════════════════════════════════════════════

class _KeyboardAwareComposer extends StatelessWidget {
  const _KeyboardAwareComposer({
    required this.child,
    required this.visualMode,
  });

  final Widget child;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      padding: EdgeInsets.fromLTRB(12, 8, 12, bottom > 0 ? 8 : 12),
      child: child,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Sven-branded pull-to-refresh indicator
// ═══════════════════════════════════════════════════════════════════════════

class _SvenRefreshIndicator extends StatelessWidget {
  const _SvenRefreshIndicator({
    required this.child,
    required this.onRefresh,
    required this.visualMode,
  });

  final Widget child;
  final RefreshCallback onRefresh;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: tokens.primary,
      backgroundColor: visualMode == VisualMode.cinematic
          ? const Color(0xFF0D1B2A)
          : Colors.white,
      strokeWidth: 2.5,
      displacement: 48,
      child: child,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TTS mini-player bar — shows above composer when Sven is speaking
// ═══════════════════════════════════════════════════════════════════════════

class _TtsMiniPlayer extends StatelessWidget {
  const _TtsMiniPlayer({
    required this.voiceService,
    required this.visualMode,
  });

  final VoiceService voiceService;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;
    final isPaused = voiceService.ttsState == TtsState.paused;

    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: cinematic
            ? tokens.surface.withValues(alpha: 0.6)
            : tokens.surface.withValues(alpha: 0.95),
        border: Border(
          top: BorderSide(
            color: cinematic
                ? tokens.primary.withValues(alpha: 0.25)
                : tokens.frame,
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.record_voice_over_rounded,
            size: 16,
            color: tokens.primary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              isPaused ? 'Paused' : 'Sven is speaking…',
              style: TextStyle(
                fontSize: 12,
                color: tokens.onSurface.withValues(alpha: 0.65),
              ),
            ),
          ),
          // Speed indicator
          GestureDetector(
            onTap: () {
              final next = voiceService.ttsSpeed < 1.5
                  ? 1.5
                  : voiceService.ttsSpeed < 2.0
                      ? 2.0
                      : 1.0;
              voiceService.setSpeed(next);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: tokens.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${voiceService.ttsSpeed.toStringAsFixed(1)}×',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: tokens.primary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Pause / resume
          IconButton(
            icon: Icon(
              isPaused ? Icons.play_arrow_rounded : Icons.pause_rounded,
              size: 20,
            ),
            color: tokens.onSurface.withValues(alpha: 0.75),
            onPressed: () {
              if (isPaused) {
                voiceService.resumeSpeaking();
              } else {
                voiceService.pauseSpeaking();
              }
            },
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
          ),
          // Stop
          IconButton(
            icon: const Icon(Icons.stop_rounded, size: 20),
            color: tokens.onSurface.withValues(alpha: 0.75),
            onPressed: voiceService.stopSpeaking,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
          ),
        ],
      ),
    );
  }
}
// ── Helpers ─────────────────────────────────────────────────────────────────

bool _isSameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

// ── Date separator widget ────────────────────────────────────────────────────

class _DateSeparator extends StatelessWidget {
  const _DateSeparator({required this.date, required this.visualMode});

  final DateTime date;
  final VisualMode visualMode;

  String _label() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(date.year, date.month, date.day);
    final diff = today.difference(d).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final suffix = diff < 365
        ? '${months[date.month - 1]} ${date.day}'
        : '${months[date.month - 1]} ${date.day}, ${date.year}';
    return suffix;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Divider(
              color: tokens.onSurface.withValues(alpha: 0.1),
              height: 1,
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: tokens.onSurface.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              _label(),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: tokens.onSurface.withValues(alpha: 0.45),
                letterSpacing: 0.3,
              ),
            ),
          ),
          Expanded(
            child: Divider(
              color: tokens.onSurface.withValues(alpha: 0.1),
              height: 1,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Reaction bar ─────────────────────────────────────────────────────────────

class _ReactionBar extends StatelessWidget {
  const _ReactionBar({
    required this.reactions,
    required this.onTap,
    required this.isUser,
    required this.tokens,
  });

  final Set<String> reactions;
  final void Function(String emoji) onTap;
  final bool isUser;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: isUser ? 0 : 56,
        right: isUser ? 16 : 0,
        bottom: 6,
      ),
      child: Wrap(
        spacing: 4,
        children: reactions.map((emoji) {
          return GestureDetector(
            onTap: () => onTap(emoji),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: tokens.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: tokens.primary.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
              child: Text(emoji, style: const TextStyle(fontSize: 14)),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// _ArtifactPage — full-screen reading view for long assistant messages
// ═══════════════════════════════════════════════════════════════════════════

class _ArtifactPage extends StatelessWidget {
  const _ArtifactPage({
    required this.message,
    required this.visualMode,
  });

  final ChatMessage message;
  final VisualMode visualMode;

  int get _wordCount {
    final s = message.text.trim();
    if (s.isEmpty) return 0;
    return s.split(RegExp(r'\s+')).length;
  }

  void _copyAll(BuildContext context) {
    Clipboard.setData(ClipboardData(text: message.text));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Copied to clipboard'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _shareAll() {
    Share.share(message.text, subject: 'Sven response');
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;

    return Scaffold(
      backgroundColor: cinematic ? tokens.scaffold : tokens.scaffold,
      appBar: AppBar(
        backgroundColor: cinematic ? tokens.card : tokens.surface,
        title: Text(
          'Sven\'s response',
          style: TextStyle(
            color: tokens.onSurface,
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        leading: IconButton(
          icon: Icon(Icons.close_rounded, color: tokens.onSurface),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.copy_rounded,
                color: tokens.onSurface.withValues(alpha: 0.7)),
            tooltip: 'Copy all',
            onPressed: () => _copyAll(context),
          ),
          IconButton(
            icon: Icon(Icons.share_rounded,
                color: tokens.onSurface.withValues(alpha: 0.7)),
            tooltip: 'Share',
            onPressed: _shareAll,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  MarkdownBody(
                    data: message.text,
                    selectable: true,
                    styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context))
                        .copyWith(
                      p: TextStyle(
                        color: tokens.onSurface,
                        fontSize: 16,
                        height: 1.6,
                      ),
                      strong: TextStyle(
                        color: tokens.onSurface,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                      code: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 13,
                        color: cinematic ? tokens.primary : tokens.onSurface,
                        backgroundColor: cinematic
                            ? tokens.primary.withValues(alpha: 0.08)
                            : tokens.onSurface.withValues(alpha: 0.06),
                      ),
                      codeblockDecoration: BoxDecoration(
                        color: cinematic
                            ? const Color(0xFF0D1117)
                            : tokens.onSurface.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(10),
                        border: cinematic
                            ? Border.all(color: tokens.frame)
                            : Border.all(
                                color:
                                    tokens.onSurface.withValues(alpha: 0.08)),
                      ),
                      codeblockPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                    ),
                  ),
                ],
              ),
            ),
          ),
          // ── Bottom bar ──
          SafeArea(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: cinematic ? tokens.card : tokens.surface,
                border: Border(
                  top: BorderSide(
                    color: cinematic
                        ? tokens.frame
                        : tokens.onSurface.withValues(alpha: 0.08),
                    width: 0.5,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Text(
                    '$_wordCount words · ${message.text.length} chars',
                    style: TextStyle(
                      fontSize: 12,
                      color: tokens.onSurface.withValues(alpha: 0.4),
                    ),
                  ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () => _copyAll(context),
                    icon: Icon(Icons.copy_rounded,
                        size: 16, color: tokens.primary),
                    label: Text('Copy all',
                        style: TextStyle(
                            color: tokens.primary,
                            fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(width: 8),
                  TextButton.icon(
                    onPressed: _shareAll,
                    icon: Icon(Icons.share_rounded,
                        size: 16, color: tokens.primary),
                    label: Text('Share',
                        style: TextStyle(
                            color: tokens.primary,
                            fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
