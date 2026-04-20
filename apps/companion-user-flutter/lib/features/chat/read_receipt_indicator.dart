import 'package:flutter/material.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';

/// Read receipt status for a message.
enum ReadStatus { sending, sent, delivered, read }

/// Compact read-receipt ticks displayed alongside sent messages.
class ReadReceiptIndicator extends StatelessWidget {
  const ReadReceiptIndicator({
    super.key,
    required this.status,
    this.visualMode = VisualMode.classic,
    this.size = 16.0,
  });

  final ReadStatus status;
  final VisualMode visualMode;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tok = SvenTokens.forMode(visualMode);

    switch (status) {
      case ReadStatus.sending:
        return Icon(Icons.access_time,
            size: size, color: tok.onSurface.withValues(alpha: 0.3));
      case ReadStatus.sent:
        return Icon(Icons.check,
            size: size, color: tok.onSurface.withValues(alpha: 0.4));
      case ReadStatus.delivered:
        return Icon(Icons.done_all,
            size: size, color: tok.onSurface.withValues(alpha: 0.4));
      case ReadStatus.read:
        return Icon(Icons.done_all, size: size, color: tok.primary);
    }
  }
}
