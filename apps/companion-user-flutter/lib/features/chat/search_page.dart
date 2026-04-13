import 'dart:async';

import 'package:flutter/material.dart';

import '../../app/app_models.dart';
import '../../app/authenticated_client.dart';
import '../../app/sven_tokens.dart';
import 'search_service.dart';

/// Full-text and semantic search across messages, files, and contacts.
class SearchPage extends StatefulWidget {
  const SearchPage({
    super.key,
    required this.client,
    this.visualMode = VisualMode.classic,
    this.chatId,
    this.onOpenChat,
  });

  final AuthenticatedClient client;
  final VisualMode visualMode;
  final String? chatId;
  final void Function(String chatId, String? messageId)? onOpenChat;

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _debounce;
  late final SearchService _searchService;

  UnifiedSearchResults? _results;
  bool _loading = false;
  String _lastQuery = '';

  // ── Advanced filters ──
  bool _showFilters = false;
  String _searchMode = 'unified'; // unified | messages | semantic
  String? _contentType; // null | text | file | image | audio | video
  DateTime? _afterDate;
  DateTime? _beforeDate;

  @override
  void initState() {
    super.initState();
    _searchService = SearchService(client: widget.client);
    _focusNode.requestFocus();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    final query = value.trim();
    if (query.length < 2) {
      setState(() {
        _results = null;
        _loading = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () {
      _performSearch(query);
    });
  }

  Future<void> _performSearch(String query) async {
    if (query == _lastQuery && !_showFilters) return;
    _lastQuery = query;
    setState(() => _loading = true);

    if (_searchMode == 'messages') {
      final msgResults = await _searchService.searchMessages(
        query,
        chatId: widget.chatId,
        contentType: _contentType,
        before: _beforeDate?.toUtc().toIso8601String(),
        after: _afterDate?.toUtc().toIso8601String(),
      );
      if (!mounted || query != _lastQuery) return;
      setState(() {
        _results = UnifiedSearchResults(
          messages: msgResults.results,
          files: const [],
          contacts: const [],
        );
        _loading = false;
      });
    } else if (_searchMode == 'semantic') {
      final semResults = await _searchService.searchSemantic(
        query,
        chatId: widget.chatId,
      );
      if (!mounted || query != _lastQuery) return;
      setState(() {
        _results = UnifiedSearchResults(
          messages: semResults.results,
          files: const [],
          contacts: const [],
        );
        _loading = false;
      });
    } else {
      final results = await _searchService.search(query);
      if (!mounted || query != _lastQuery) return;
      setState(() {
        _results = results;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tok = SvenTokens.forMode(widget.visualMode);

    return Container(
      decoration: BoxDecoration(gradient: tok.backgroundGradient),
      child: SafeArea(
        child: Column(
          children: [
            _buildSearchBar(tok),
            _buildFilterToggle(tok),
            if (_showFilters) _buildFilterPanel(tok),
            if (_loading)
              LinearProgressIndicator(
                minHeight: 2,
                color: tok.primary,
                backgroundColor: tok.frame,
              ),
            Expanded(child: _buildResults(tok)),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar(SvenModeTokens tok) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: TextField(
        controller: _controller,
        focusNode: _focusNode,
        onChanged: _onChanged,
        style: TextStyle(color: tok.onSurface, fontSize: 16),
        decoration: InputDecoration(
          hintText: 'Search messages, files...',
          hintStyle: TextStyle(color: tok.onSurface.withValues(alpha: 0.4)),
          prefixIcon: Icon(Icons.search, color: tok.primary),
          suffixIcon: _controller.text.isNotEmpty
              ? IconButton(
                  icon: Icon(Icons.clear, color: tok.onSurface.withValues(alpha: 0.4)),
                  onPressed: () {
                    _controller.clear();
                    _onChanged('');
                  },
                )
              : null,
          filled: true,
          fillColor: tok.card,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: tok.frame),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: tok.frame),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: tok.primary, width: 2),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }

  Widget _buildFilterToggle(SvenModeTokens tok) {
    final hasActiveFilters =
        _searchMode != 'unified' || _contentType != null || _afterDate != null || _beforeDate != null;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => setState(() => _showFilters = !_showFilters),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _showFilters ? Icons.filter_list_off : Icons.filter_list,
                  size: 18,
                  color: hasActiveFilters ? tok.primary : tok.onSurface.withValues(alpha: 0.5),
                ),
                const SizedBox(width: 4),
                Text(
                  'Filters',
                  style: TextStyle(
                    fontSize: 13,
                    color: hasActiveFilters ? tok.primary : tok.onSurface.withValues(alpha: 0.5),
                    fontWeight: hasActiveFilters ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
              ],
            ),
          ),
          if (hasActiveFilters) ...[
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () {
                setState(() {
                  _searchMode = 'unified';
                  _contentType = null;
                  _afterDate = null;
                  _beforeDate = null;
                });
                if (_lastQuery.isNotEmpty) {
                  _lastQuery = '';
                  _performSearch(_controller.text.trim());
                }
              },
              child: Text(
                'Clear',
                style: TextStyle(fontSize: 12, color: tok.error),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFilterPanel(SvenModeTokens tok) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tok.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tok.frame),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Search mode', style: TextStyle(fontSize: 12, color: tok.onSurface.withValues(alpha: 0.6))),
          const SizedBox(height: 6),
          _buildChipRow(tok, [
            _filterChip(tok, 'Unified', _searchMode == 'unified', () => _setMode('unified')),
            _filterChip(tok, 'Full-text', _searchMode == 'messages', () => _setMode('messages')),
            _filterChip(tok, 'Semantic', _searchMode == 'semantic', () => _setMode('semantic')),
          ]),
          if (_searchMode == 'messages') ...[
            const SizedBox(height: 12),
            Text('Content type', style: TextStyle(fontSize: 12, color: tok.onSurface.withValues(alpha: 0.6))),
            const SizedBox(height: 6),
            _buildChipRow(tok, [
              _filterChip(tok, 'All', _contentType == null, () => _setContentType(null)),
              _filterChip(tok, 'Text', _contentType == 'text', () => _setContentType('text')),
              _filterChip(tok, 'Files', _contentType == 'file', () => _setContentType('file')),
              _filterChip(tok, 'Images', _contentType == 'image', () => _setContentType('image')),
              _filterChip(tok, 'Audio', _contentType == 'audio', () => _setContentType('audio')),
            ]),
            const SizedBox(height: 12),
            Text('Date range', style: TextStyle(fontSize: 12, color: tok.onSurface.withValues(alpha: 0.6))),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: _datePicker(tok, 'After', _afterDate, (d) {
                    setState(() => _afterDate = d);
                    _rerunSearch();
                  }),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _datePicker(tok, 'Before', _beforeDate, (d) {
                    setState(() => _beforeDate = d);
                    _rerunSearch();
                  }),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildChipRow(SvenModeTokens tok, List<Widget> chips) {
    return Wrap(spacing: 6, runSpacing: 4, children: chips);
  }

  Widget _filterChip(SvenModeTokens tok, String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? tok.primary.withValues(alpha: 0.15) : tok.frame.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: selected ? tok.primary : tok.frame),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: selected ? tok.primary : tok.onSurface.withValues(alpha: 0.7),
            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _datePicker(SvenModeTokens tok, String label, DateTime? value, ValueChanged<DateTime?> onChanged) {
    return GestureDetector(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: value ?? DateTime.now(),
          firstDate: DateTime(2020),
          lastDate: DateTime.now(),
        );
        onChanged(picked);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: tok.frame.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: tok.frame),
        ),
        child: Row(
          children: [
            Icon(Icons.calendar_today, size: 14, color: tok.onSurface.withValues(alpha: 0.5)),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                value != null ? '${value.month}/${value.day}/${value.year}' : label,
                style: TextStyle(
                  fontSize: 12,
                  color: value != null ? tok.onSurface : tok.onSurface.withValues(alpha: 0.4),
                ),
              ),
            ),
            if (value != null)
              GestureDetector(
                onTap: () => onChanged(null),
                child: Icon(Icons.close, size: 14, color: tok.onSurface.withValues(alpha: 0.4)),
              ),
          ],
        ),
      ),
    );
  }

  void _setMode(String mode) {
    setState(() => _searchMode = mode);
    _rerunSearch();
  }

  void _setContentType(String? type) {
    setState(() => _contentType = type);
    _rerunSearch();
  }

  void _rerunSearch() {
    final query = _controller.text.trim();
    if (query.length >= 2) {
      _lastQuery = '';
      _performSearch(query);
    }
  }

  Widget _buildResults(SvenModeTokens tok) {
    if (_results == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search, size: 64, color: tok.onSurface.withValues(alpha: 0.15)),
            const SizedBox(height: 12),
            Text(
              'Search your conversations',
              style: TextStyle(color: tok.onSurface.withValues(alpha: 0.4), fontSize: 16),
            ),
          ],
        ),
      );
    }

    final messages = _results!.messages;
    final files = _results!.files;
    final contacts = _results!.contacts;
    final total = messages.length + files.length + contacts.length;

    if (total == 0) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_off, size: 64, color: tok.onSurface.withValues(alpha: 0.15)),
            const SizedBox(height: 12),
            Text(
              'No results for "$_lastQuery"',
              style: TextStyle(color: tok.onSurface.withValues(alpha: 0.4), fontSize: 16),
            ),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      children: [
        if (messages.isNotEmpty) ...[
          _sectionHeader('Messages (${messages.length})', tok),
          ...messages.map((m) => _messageTile(m, tok)),
        ],
        if (files.isNotEmpty) ...[
          _sectionHeader('Files (${files.length})', tok),
          ...files.map((f) => _fileTile(f, tok)),
        ],
        if (contacts.isNotEmpty) ...[
          _sectionHeader('Contacts (${contacts.length})', tok),
          ...contacts.map((c) => _contactTile(c, tok)),
        ],
      ],
    );
  }

  Widget _sectionHeader(String title, SvenModeTokens tok) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: tok.primary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _messageTile(SearchResult m, SvenModeTokens tok) {
    return Card(
      color: tok.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: tok.frame.withValues(alpha: 0.5)),
      ),
      margin: const EdgeInsets.only(bottom: 6),
      child: ListTile(
        dense: true,
        leading: CircleAvatar(
          radius: 18,
          backgroundColor: tok.primary.withValues(alpha: 0.15),
          child: Icon(
            Icons.chat_bubble_outline,
            size: 18,
            color: tok.primary,
          ),
        ),
        title: Text(
          m.senderName ?? m.chatId,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: tok.onSurface,
          ),
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          m.headline ?? m.text ?? '',
          style: TextStyle(fontSize: 12, color: tok.onSurface.withValues(alpha: 0.6)),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: m.sentAt != null
            ? Text(
                _formatDate(m.sentAt!),
                style: TextStyle(fontSize: 10, color: tok.onSurface.withValues(alpha: 0.35)),
              )
            : null,
        onTap: () => widget.onOpenChat?.call(m.chatId, m.messageId),
      ),
    );
  }

  Widget _fileTile(FileSearchResult f, SvenModeTokens tok) {
    return Card(
      color: tok.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: tok.frame.withValues(alpha: 0.5)),
      ),
      margin: const EdgeInsets.only(bottom: 6),
      child: ListTile(
        dense: true,
        leading: CircleAvatar(
          radius: 18,
          backgroundColor: tok.secondary.withValues(alpha: 0.15),
          child: Icon(_fileIcon(f.mimeType), size: 18, color: tok.secondary),
        ),
        title: Text(
          f.fileName,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: tok.onSurface),
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          f.mimeType ?? 'Unknown type',
          style: TextStyle(fontSize: 11, color: tok.onSurface.withValues(alpha: 0.5)),
        ),
      ),
    );
  }

  Widget _contactTile(ContactSearchResult c, SvenModeTokens tok) {
    return Card(
      color: tok.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: tok.frame.withValues(alpha: 0.5)),
      ),
      margin: const EdgeInsets.only(bottom: 6),
      child: ListTile(
        dense: true,
        leading: CircleAvatar(
          radius: 18,
          backgroundColor: tok.primary.withValues(alpha: 0.15),
          child: Text(
            c.displayName.isNotEmpty ? c.displayName[0].toUpperCase() : '?',
            style: TextStyle(color: tok.primary, fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(
          c.displayName,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: tok.onSurface),
        ),
        subtitle: c.email != null
            ? Text(c.email!, style: TextStyle(fontSize: 11, color: tok.onSurface.withValues(alpha: 0.5)))
            : null,
      ),
    );
  }

  IconData _fileIcon(String? mime) {
    if (mime == null) return Icons.insert_drive_file;
    if (mime.startsWith('image/')) return Icons.image;
    if (mime.startsWith('video/')) return Icons.videocam;
    if (mime.startsWith('audio/')) return Icons.audiotrack;
    if (mime.contains('pdf')) return Icons.picture_as_pdf;
    return Icons.insert_drive_file;
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'now';
    if (diff.inHours < 1) return '${diff.inMinutes}m';
    if (diff.inDays < 1) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${dt.month}/${dt.day}';
  }
}
