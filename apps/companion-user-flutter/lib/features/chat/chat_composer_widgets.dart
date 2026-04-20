part of 'chat_composer.dart';

class _Pressable extends StatefulWidget {
  const _Pressable({super.key, required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 90),
    reverseDuration: const Duration(milliseconds: 200),
    lowerBound: 0.0,
    upperBound: 1.0,
    value: 0.0,
  );

  final _scaleAnim = Tween<double>(begin: 1.0, end: 0.88);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: widget.onTap != null ? (_) => _ctrl.forward() : null,
      onTapUp: widget.onTap != null
          ? (_) {
              _ctrl.reverse();
              widget.onTap!();
            }
          : null,
      onTapCancel: () => _ctrl.reverse(),
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, child) => Transform.scale(
          scale: _scaleAnim.evaluate(_ctrl),
          child: child,
        ),
        child: widget.child,
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Attachment preview strips
// ═══════════════════════════════════════════════════════════════════════════

class _MultiImagePreviewStrip extends StatelessWidget {
  const _MultiImagePreviewStrip({
    required this.images,
    required this.onRemoveAt,
    required this.onClearAll,
    required this.maxImages,
    required this.tokens,
    required this.cinematic,
  });

  final List<XFile> images;
  final void Function(int index) onRemoveAt;
  final VoidCallback onClearAll;
  final int maxImages;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with count and clear-all
          Row(
            children: [
              Text(
                '${images.length} image${images.length > 1 ? 's' : ''} attached',
                style: TextStyle(
                  color: tokens.primary.withValues(alpha: 0.7),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (images.length < maxImages) ...[
                const SizedBox(width: 8),
                Text(
                  '(max $maxImages)',
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.3),
                    fontSize: 10,
                  ),
                ),
              ],
              const Spacer(),
              if (images.length > 1)
                Material(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    onTap: onClearAll,
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      child: Text(
                        'Clear all',
                        style: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.4),
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          // Horizontal thumbnail row
          SizedBox(
            height: 64,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: images.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (ctx, i) => _ImageThumb(
                imagePath: images[i].path,
                onRemove: () => onRemoveAt(i),
                tokens: tokens,
                cinematic: cinematic,
                heroTag: 'composer_img_$i',
                onTap: kIsWeb
                    ? null
                    : () => Navigator.of(ctx).push<void>(
                          PageRouteBuilder<void>(
                            opaque: false,
                            pageBuilder: (_, __, ___) => _FullScreenImageViewer(
                              imagePath: images[i].path,
                              heroTag: 'composer_img_$i',
                            ),
                            transitionsBuilder: (_, anim, __, child) =>
                                FadeTransition(
                              opacity: CurvedAnimation(
                                  parent: anim, curve: Curves.easeOut),
                              child: child,
                            ),
                          ),
                        ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ImageThumb extends StatelessWidget {
  const _ImageThumb({
    required this.imagePath,
    required this.onRemove,
    required this.tokens,
    required this.cinematic,
    this.onTap,
    required this.heroTag,
  });

  final String imagePath;
  final VoidCallback onRemove;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback? onTap;
  final String heroTag;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Hero(
            tag: heroTag,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 64,
                height: 64,
                child: kIsWeb
                    ? Container(
                        color: tokens.primary.withValues(alpha: 0.1),
                        child: Icon(Icons.image_rounded,
                            color: tokens.primary, size: 28),
                      )
                    : Image.file(
                        File(imagePath),
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          color: tokens.primary.withValues(alpha: 0.1),
                          child: Icon(Icons.image_rounded,
                              color: tokens.primary, size: 28),
                        ),
                      ),
              ),
            ),
          ),
          Positioned(
            top: -4,
            right: -4,
            child: GestureDetector(
              onTap: onRemove,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: cinematic ? tokens.card : tokens.surface,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: tokens.onSurface.withValues(alpha: 0.1),
                  ),
                ),
                child: Icon(Icons.close_rounded,
                    size: 12, color: tokens.onSurface.withValues(alpha: 0.5)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Quote / reply strip
// ───────────────────────────────────────────────────────────────────────────

class _QuoteStrip extends StatelessWidget {
  const _QuoteStrip({
    required this.message,
    required this.onRemove,
    required this.tokens,
    required this.cinematic,
  });

  final ChatMessage message;
  final VoidCallback onRemove;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == 'user';
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: tokens.primary.withValues(alpha: cinematic ? 0.08 : 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border(
          left: BorderSide(color: tokens.primary, width: 3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  isUser ? 'You' : 'Sven',
                  style: TextStyle(
                    color: tokens.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  message.text,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.7),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onRemove,
            child: Icon(
              Icons.close_rounded,
              size: 16,
              color: tokens.onSurface.withValues(alpha: 0.4),
            ),
          ),
        ],
      ),
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Slash command overlay (anchored above composer)
// ───────────────────────────────────────────────────────────────────────────

class _SlashCommandOverlay extends StatelessWidget {
  const _SlashCommandOverlay({
    required this.layerLink,
    required this.commands,
    required this.tokens,
    required this.cinematic,
    required this.onSelected,
  });

  final LayerLink layerLink;
  final List<SlashCommand> commands;
  final SvenModeTokens tokens;
  final bool cinematic;
  final ValueChanged<SlashCommand> onSelected;

  @override
  Widget build(BuildContext context) {
    if (commands.isEmpty) return const SizedBox.shrink();
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: CompositedTransformFollower(
        link: layerLink,
        targetAnchor: Alignment.topLeft,
        followerAnchor: Alignment.bottomLeft,
        offset: const Offset(0, -8),
        child: Material(
          color: Colors.transparent,
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: cinematic
                  ? const Color(0xFF0D1829)
                  : Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: tokens.primary.withValues(alpha: 0.25),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: cinematic ? 0.5 : 0.15),
                  blurRadius: 24,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  child: Row(
                    children: [
                      Icon(Icons.terminal_rounded,
                          size: 13,
                          color: tokens.primary.withValues(alpha: 0.7)),
                      const SizedBox(width: 6),
                      Text(
                        'Slash commands',
                        style: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.45),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                ...commands.map(
                  (cmd) => InkWell(
                    onTap: () => onSelected(cmd),
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      child: Row(
                        children: [
                          Icon(cmd.icon,
                              size: 18,
                              color: tokens.primary.withValues(alpha: 0.8)),
                          const SizedBox(width: 12),
                          Text(
                            '/${cmd.command}',
                            style: TextStyle(
                              color: tokens.primary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              cmd.description,
                              style: TextStyle(
                                color: tokens.onSurface.withValues(alpha: 0.55),
                                fontSize: 13,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Data class for @-mention commands ─────────────────────────────────────
class _AtMention {
  const _AtMention({
    required this.trigger,
    required this.label,
    required this.icon,
    required this.prefix,
  });

  final String trigger;
  final String label;
  final IconData icon;
  final String prefix;
}

// ── @-mention overlay widget ────────────────────────────────────────────────
class _AtMentionOverlay extends StatelessWidget {
  const _AtMentionOverlay({
    required this.layerLink,
    required this.mentions,
    required this.tokens,
    required this.cinematic,
    required this.onSelected,
  });

  final LayerLink layerLink;
  final List<_AtMention> mentions;
  final SvenModeTokens tokens;
  final bool cinematic;
  final ValueChanged<_AtMention> onSelected;

  @override
  Widget build(BuildContext context) {
    if (mentions.isEmpty) return const SizedBox.shrink();
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: CompositedTransformFollower(
        link: layerLink,
        targetAnchor: Alignment.topLeft,
        followerAnchor: Alignment.bottomLeft,
        offset: const Offset(0, -8),
        child: Material(
          color: Colors.transparent,
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: cinematic
                  ? const Color(0xFF0D1829)
                  : Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: tokens.primary.withValues(alpha: 0.25),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: cinematic ? 0.5 : 0.15),
                  blurRadius: 24,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  child: Row(
                    children: [
                      Icon(Icons.alternate_email_rounded,
                          size: 13,
                          color: tokens.primary.withValues(alpha: 0.7)),
                      const SizedBox(width: 6),
                      Text(
                        'Mention a mode',
                        style: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.45),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                ...mentions.map(
                  (m) => InkWell(
                    onTap: () => onSelected(m),
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      child: Row(
                        children: [
                          Icon(m.icon,
                              size: 18,
                              color: tokens.primary.withValues(alpha: 0.8)),
                          const SizedBox(width: 12),
                          Text(
                            '@${m.trigger}',
                            style: TextStyle(
                              color: tokens.primary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              m.label,
                              style: TextStyle(
                                color: tokens.onSurface.withValues(alpha: 0.55),
                                fontSize: 13,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FilePreviewStrip extends StatelessWidget {
  const _FilePreviewStrip({
    required this.fileName,
    required this.fileSize,
    required this.onRemove,
    required this.tokens,
    required this.cinematic,
    this.previewText,
    this.contentCharCount,
  });

  final String fileName;
  final int fileSize;
  final String? previewText;

  /// When non-null, the full file content was read and will be sent to the AI.
  final int? contentCharCount;
  final VoidCallback onRemove;
  final SvenModeTokens tokens;
  final bool cinematic;

  String get _formattedSize {
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1024 * 1024) {
      return '${(fileSize / 1024).toStringAsFixed(1)} KB';
    }
    return '${(fileSize / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  IconData get _fileIcon {
    final ext = fileName.split('.').last.toLowerCase();
    return switch (ext) {
      'pdf' => Icons.picture_as_pdf_rounded,
      'doc' || 'docx' => Icons.description_rounded,
      'xls' || 'xlsx' || 'csv' => Icons.table_chart_rounded,
      'ppt' || 'pptx' => Icons.slideshow_rounded,
      'zip' || 'rar' || '7z' => Icons.folder_zip_rounded,
      'json' || 'xml' || 'md' || 'txt' || 'log' => Icons.code_rounded,
      'dart' ||
      'py' ||
      'js' ||
      'ts' ||
      'jsx' ||
      'tsx' ||
      'go' ||
      'rs' ||
      'java' ||
      'kt' ||
      'swift' ||
      'c' ||
      'cpp' ||
      'cs' ||
      'rb' ||
      'php' ||
      'html' ||
      'htm' ||
      'css' ||
      'scss' ||
      'vue' ||
      'svelte' ||
      'sql' ||
      'sh' ||
      'bash' ||
      'zsh' ||
      'ps1' ||
      'yaml' ||
      'yml' ||
      'toml' =>
        Icons.data_object_rounded,
      _ => Icons.insert_drive_file_rounded,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: cinematic
                  ? tokens.primary.withValues(alpha: 0.1)
                  : tokens.onSurface.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(_fileIcon,
                color: tokens.primary.withValues(alpha: 0.8), size: 24),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  fileName,
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  _formattedSize,
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.5),
                    fontSize: 11,
                  ),
                ),
                if (previewText != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    previewText!,
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: tokens.onSurface.withValues(alpha: 0.45),
                      height: 1.3,
                    ),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (contentCharCount != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.check_circle_rounded,
                          size: 11,
                          color: tokens.primary.withValues(alpha: 0.8)),
                      const SizedBox(width: 3),
                      Text(
                        'Content attached · ${contentCharCount! > 999 ? '${(contentCharCount! / 1000).toStringAsFixed(1)}k' : contentCharCount} chars',
                        style: TextStyle(
                          color: tokens.primary.withValues(alpha: 0.8),
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              onTap: onRemove,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Icon(Icons.close_rounded,
                    size: 18, color: tokens.onSurface.withValues(alpha: 0.4)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Animated gradient progress bar for send / upload feedback
// ═══════════════════════════════════════════════════════════════════════════

class _SvenProgressBar extends StatelessWidget {
  const _SvenProgressBar({
    required this.animation,
    required this.tokens,
    required this.cinematic,
    required this.label,
  });

  final Animation<double> animation;
  final SvenModeTokens tokens;
  final bool cinematic;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Label row
          Row(
            children: [
              SizedBox(
                width: 10,
                height: 10,
                child: AnimatedBuilder(
                  animation: animation,
                  builder: (_, __) => CircularProgressIndicator(
                    strokeWidth: 1.5,
                    value: null, // indeterminate spinner
                    color: tokens.primary.withValues(alpha: 0.6),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: tokens.onSurface.withValues(alpha: 0.45),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              AnimatedBuilder(
                animation: animation,
                builder: (_, __) => Text(
                  '${(animation.value * 100).toInt()}%',
                  style: TextStyle(
                    fontSize: 10,
                    color: tokens.primary.withValues(alpha: 0.55),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          // Gradient bar
          AnimatedBuilder(
            animation: animation,
            builder: (_, __) {
              return ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: Container(
                  height: 4,
                  color: tokens.primary.withValues(alpha: 0.08),
                  child: FractionallySizedBox(
                    widthFactor: animation.value.clamp(0.02, 1.0),
                    alignment: Alignment.centerLeft,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(4),
                        gradient: LinearGradient(
                          colors: cinematic
                              ? [
                                  tokens.primary,
                                  tokens.secondary,
                                ]
                              : [
                                  tokens.primary.withValues(alpha: 0.7),
                                  tokens.primary,
                                ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: tokens.primary.withValues(alpha: 0.35),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// _DragOverlay — visual hint shown while a file is dragged over the composer
// ═══════════════════════════════════════════════════════════════════════════

class _DragOverlay extends StatelessWidget {
  const _DragOverlay({required this.tokens, required this.cinematic});

  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(26),
          color: cinematic
              ? tokens.primary.withValues(alpha: 0.12)
              : tokens.primary.withValues(alpha: 0.07),
          border: Border.all(
            color: tokens.primary.withValues(alpha: cinematic ? 0.65 : 0.45),
            width: 2,
          ),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.file_download_outlined,
                color: tokens.primary,
                size: 32,
              ),
              const SizedBox(height: 8),
              Text(
                'Drop to attach',
                style: TextStyle(
                  color: tokens.primary,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
// ───────────────────────────────────────────────────────────────────────────
// _FullScreenImageViewer — hero-animated full-screen pinch-to-zoom image view
// ───────────────────────────────────────────────────────────────────────────

class _FullScreenImageViewer extends StatelessWidget {
  const _FullScreenImageViewer({
    required this.imagePath,
    required this.heroTag,
  });

  final String imagePath;
  final String heroTag;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Center(
            child: Hero(
              tag: heroTag,
              child: InteractiveViewer(
                minScale: 0.5,
                maxScale: 5.0,
                child: Image.file(
                  File(imagePath),
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(
                    Icons.broken_image_rounded,
                    color: Colors.white38,
                    size: 64,
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            right: 12,
            child: Semantics(
              label: 'Close full screen image',
              button: true,
              child: IconButton.filled(
                onPressed: () => Navigator.of(context).pop(),
                style: IconButton.styleFrom(
                  backgroundColor: Colors.black54,
                ),
                icon: const Icon(Icons.close_rounded,
                    color: Colors.white, size: 22),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
