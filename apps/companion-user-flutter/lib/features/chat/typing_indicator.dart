import 'package:flutter/material.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';

/// Animated typing indicator showing bouncing dots when remote users are typing.
class TypingIndicator extends StatefulWidget {
  const TypingIndicator({
    super.key,
    required this.typingUsers,
    this.visualMode = VisualMode.classic,
  });

  final List<String> typingUsers;
  final VisualMode visualMode;

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _label() {
    final users = widget.typingUsers;
    if (users.isEmpty) return '';
    if (users.length == 1) return '${users.first} is typing';
    if (users.length == 2) return '${users[0]} and ${users[1]} are typing';
    return '${users[0]} and ${users.length - 1} others are typing';
  }

  @override
  Widget build(BuildContext context) {
    if (widget.typingUsers.isEmpty) return const SizedBox.shrink();

    final tok = SvenTokens.forMode(widget.visualMode);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _BouncingDots(controller: _controller, color: tok.primary),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              _label(),
              style: TextStyle(
                fontSize: 12,
                color: tok.onSurface.withValues(alpha: 0.5),
                fontStyle: FontStyle.italic,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _BouncingDots extends StatelessWidget {
  const _BouncingDots({required this.controller, required this.color});

  final AnimationController controller;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (i) {
        return AnimatedBuilder(
          animation: controller,
          builder: (context, child) {
            final phase = (controller.value + i * 0.2) % 1.0;
            final y = -4.0 * (phase < 0.5 ? phase : 1.0 - phase);
            return Transform.translate(offset: Offset(0, y), child: child);
          },
          child: Container(
            width: 6,
            height: 6,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.7),
              shape: BoxShape.circle,
            ),
          ),
        );
      }),
    );
  }
}
