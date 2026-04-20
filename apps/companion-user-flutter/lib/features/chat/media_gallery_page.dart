import 'dart:async';

import 'package:flutter/material.dart';

import '../../app/app_models.dart';
import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';
import '../../app/sven_tokens.dart';
import 'media_service.dart';

/// Grid-based media gallery for a chat, showing images, videos, and files.
class MediaGalleryPage extends StatefulWidget {
  const MediaGalleryPage({
    super.key,
    required this.client,
    required this.chatId,
    this.chatName,
    this.visualMode = VisualMode.classic,
  });

  final AuthenticatedClient client;
  final String chatId;
  final String? chatName;
  final VisualMode visualMode;

  @override
  State<MediaGalleryPage> createState() => _MediaGalleryPageState();
}

class _MediaGalleryPageState extends State<MediaGalleryPage>
    with SingleTickerProviderStateMixin {
  late final MediaService _mediaService;
  late final TabController _tabController;

  List<MediaUpload> _all = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _mediaService = MediaService(client: widget.client);
    _tabController = TabController(length: 3, vsync: this);
    _loadGallery();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadGallery() async {
    setState(() => _loading = true);
    final gallery = await _mediaService.getChatGallery(
      widget.chatId,
      limit: 100,
    );
    if (!mounted) return;
    setState(() {
      _all = gallery.items;
      _loading = false;
    });
  }

  List<MediaUpload> _filtered(String type) {
    if (type == 'all') return _all;
    return _all.where((m) => m.mimeType.startsWith(type)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final tok = SvenTokens.forMode(widget.visualMode);

    return Scaffold(
      backgroundColor: tok.scaffold,
      appBar: AppBar(
        title: Text(
          widget.chatName != null ? '${widget.chatName} — Media' : 'Media',
          style: TextStyle(color: tok.onSurface, fontSize: 18),
        ),
        backgroundColor: tok.surface,
        iconTheme: IconThemeData(color: tok.onSurface),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: tok.primary,
          labelColor: tok.primary,
          unselectedLabelColor: tok.onSurface.withValues(alpha: 0.5),
          tabs: const [
            Tab(text: 'Images'),
            Tab(text: 'Videos'),
            Tab(text: 'Files'),
          ],
        ),
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: tok.primary))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildGrid(_filtered('image'), tok),
                _buildGrid(_filtered('video'), tok),
                _buildList(_filtered('application'), tok),
              ],
            ),
    );
  }

  Widget _buildGrid(List<MediaUpload> items, SvenModeTokens tok) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.photo_library_outlined,
              size: 48,
              color: tok.onSurface.withValues(alpha: 0.15),
            ),
            const SizedBox(height: 8),
            Text(
              'No media yet',
              style: TextStyle(color: tok.onSurface.withValues(alpha: 0.4)),
            ),
          ],
        ),
      );
    }

    final base = ApiBaseService.currentSync();

    return GridView.builder(
      padding: const EdgeInsets.all(4),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 4,
        crossAxisSpacing: 4,
      ),
      itemCount: items.length,
      itemBuilder: (context, i) {
        final item = items[i];
        final isImage = item.mimeType.startsWith('image');

        return GestureDetector(
          onTap: () => _showPreview(context, item, tok),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (isImage)
                  Image.network(
                    '$base/v1/media/${item.id}/thumbnail',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: tok.card,
                      child: Icon(
                        Icons.broken_image,
                        color: tok.onSurface.withValues(alpha: 0.3),
                      ),
                    ),
                  )
                else
                  Container(
                    color: tok.card,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.videocam, color: tok.primary, size: 32),
                        const SizedBox(height: 4),
                        Text(
                          item.fileName,
                          style: TextStyle(
                            fontSize: 10,
                            color: tok.onSurface.withValues(alpha: 0.6),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                if (!isImage)
                  Positioned(
                    bottom: 4,
                    right: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Icon(
                        Icons.play_circle_outline,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildList(List<MediaUpload> items, SvenModeTokens tok) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.folder_open,
              size: 48,
              color: tok.onSurface.withValues(alpha: 0.15),
            ),
            const SizedBox(height: 8),
            Text(
              'No files yet',
              style: TextStyle(color: tok.onSurface.withValues(alpha: 0.4)),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: items.length,
      itemBuilder: (context, i) {
        final item = items[i];
        return Card(
          color: tok.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: BorderSide(color: tok.frame.withValues(alpha: 0.5)),
          ),
          margin: const EdgeInsets.only(bottom: 6),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: tok.secondary.withValues(alpha: 0.15),
              child: Icon(
                _fileIcon(item.mimeType),
                color: tok.secondary,
                size: 22,
              ),
            ),
            title: Text(
              item.fileName,
              style: TextStyle(fontSize: 14, color: tok.onSurface),
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              _formatSize(item.sizeBytes),
              style: TextStyle(
                fontSize: 12,
                color: tok.onSurface.withValues(alpha: 0.5),
              ),
            ),
            trailing: Icon(Icons.download, color: tok.primary),
          ),
        );
      },
    );
  }

  void _showPreview(
    BuildContext context,
    MediaUpload item,
    SvenModeTokens tok,
  ) {
    final base = ApiBaseService.currentSync();
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.network(
            '$base/v1/media/${item.id}/download',
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => Container(
              width: 200,
              height: 200,
              color: tok.card,
              child: Center(
                child: Icon(
                  Icons.broken_image,
                  color: tok.onSurface.withValues(alpha: 0.3),
                  size: 48,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  IconData _fileIcon(String mime) {
    if (mime.startsWith('image/')) return Icons.image;
    if (mime.startsWith('video/')) return Icons.videocam;
    if (mime.startsWith('audio/')) return Icons.audiotrack;
    if (mime.contains('pdf')) return Icons.picture_as_pdf;
    if (mime.contains('zip') || mime.contains('tar')) return Icons.archive;
    return Icons.insert_drive_file;
  }

  String _formatSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
