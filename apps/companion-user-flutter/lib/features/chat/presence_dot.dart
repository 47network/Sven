import 'package:flutter/material.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';

/// Online/offline/away presence indicator dot.
class PresenceDot extends StatelessWidget {
  const PresenceDot({
    super.key,
    required this.status,
    this.visualMode = VisualMode.classic,
    this.size = 10.0,
  });

  /// 'online', 'away', 'dnd', or 'offline'.
  final String status;
  final VisualMode visualMode;
  final double size;

  Color _color(SvenModeTokens tok) {
    switch (status) {
      case 'online':
        return tok.success;
      case 'away':
        return const Color(0xFFFFA500);
      case 'dnd':
        return tok.error;
      default:
        return tok.onSurface.withValues(alpha: 0.3);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tok = SvenTokens.forMode(visualMode);
    final color = _color(tok);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: tok.surface, width: 2),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.4),
            blurRadius: 4,
            spreadRadius: 1,
          ),
        ],
      ),
    );
  }
}
