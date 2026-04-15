import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'brain_models.dart';
import 'brain_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// BrainPage — immersive 3D knowledge graph visualisation
//
// Auto-rotating 3D perspective view with depth-based effects, glowing nodes,
// animated particle trails along connections, drag-to-rotate, pinch-to-zoom.
// ═══════════════════════════════════════════════════════════════════════════

class BrainPage extends StatefulWidget {
  const BrainPage({super.key, required this.brainService});

  final BrainService brainService;

  @override
  State<BrainPage> createState() => _BrainPageState();
}

class _BrainPageState extends State<BrainPage> with TickerProviderStateMixin {
  late final AnimationController _rotationController;
  late final AnimationController _pulseController;
  late final AnimationController _particleController;

  double _rotationY = 0.0;
  double _rotationX = 0.15;
  bool _autoRotate = true;

  BrainService get _service => widget.brainService;

  @override
  void initState() {
    super.initState();
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 30),
    )..repeat();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);
    _particleController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();

    _service.addListener(_onServiceChanged);
    _service.fetchGraph();
  }

  @override
  void dispose() {
    _rotationController.dispose();
    _pulseController.dispose();
    _particleController.dispose();
    _service.removeListener(_onServiceChanged);
    super.dispose();
  }

  void _onServiceChanged() {
    if (mounted) setState(() {});
  }

  double get _currentRotY => _autoRotate
      ? _rotationY + _rotationController.value * 2 * pi
      : _rotationY;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor:
          isDark ? const Color(0xFF0a0e1a) : const Color(0xFFF0F2F8),
      appBar: AppBar(
        title: const Text('Brain Map'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(_autoRotate
                ? Icons.pause_circle_outline
                : Icons.play_circle_outline),
            onPressed: () => setState(() => _autoRotate = !_autoRotate),
            tooltip: _autoRotate ? 'Pause rotation' : 'Resume rotation',
          ),
          IconButton(
            icon: const Icon(Icons.center_focus_strong),
            onPressed: () {
              _service.resetZoom();
              setState(() {
                _rotationY = 0;
                _rotationX = 0.15;
                _autoRotate = true;
              });
            },
            tooltip: 'Reset view',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _service.fetchGraph,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Column(
        children: [
          _buildFilterBar(isDark),
          Expanded(child: _buildGraphArea(isDark)),
          if (_service.graph != null) _buildStatsBar(isDark),
          if (_service.selectedNodeId != null) _buildDetailSheet(isDark),
        ],
      ),
    );
  }

  // ── Filter chips ───────────────────────────────────────────────────────

  Widget _buildFilterBar(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: BrainNodeType.values.map((type) {
          final active = _service.activeFilters.contains(type);
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: FilterChip(
              label: Text(type.name),
              selected: active,
              selectedColor: _nodeColor(type).withValues(alpha: 0.3),
              checkmarkColor: _nodeColor(type),
              onSelected: (_) => _service.toggleFilter(type),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── 3D graph canvas ────────────────────────────────────────────────────

  Widget _buildGraphArea(bool isDark) {
    if (_service.loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_service.error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.warning_amber,
                  color: Colors.orange.shade400, size: 48),
              const SizedBox(height: 12),
              Text(
                _service.error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: isDark ? Colors.white70 : Colors.black54,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _service.fetchGraph,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_service.graph == null || _service.filteredNodes.isEmpty) {
      return Center(
        child: Text(
          'No brain data yet',
          style: TextStyle(color: isDark ? Colors.white38 : Colors.black38),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final canvasSize =
            Size(constraints.maxWidth, constraints.maxHeight);

        return GestureDetector(
          onScaleUpdate: (details) {
            setState(() {
              if (details.pointerCount == 1) {
                _autoRotate = false;
                _rotationY += details.focalPointDelta.dx * 0.005;
                _rotationX += details.focalPointDelta.dy * 0.005;
                _rotationX = _rotationX.clamp(-pi / 2.5, pi / 2.5);
              } else if (details.scale != 1.0) {
                _service
                    .setZoom(_service.zoom * details.scale.clamp(0.95, 1.05));
              }
            });
          },
          onTapUp: (details) => _handleTap(details, canvasSize),
          child: AnimatedBuilder(
            animation: Listenable.merge([
              _rotationController,
              _pulseController,
              _particleController,
            ]),
            builder: (context, _) {
              return CustomPaint(
                painter: _Brain3DPainter(
                  nodes: _service.filteredNodes,
                  edges: _service.filteredEdges,
                  zoom: _service.zoom,
                  rotationY: _currentRotY,
                  rotationX: _rotationX,
                  selectedNodeId: _service.selectedNodeId,
                  pulseValue: _pulseController.value,
                  particleValue: _particleController.value,
                  isDark: isDark,
                ),
                size: Size.infinite,
              );
            },
          ),
        );
      },
    );
  }

  void _handleTap(TapUpDetails details, Size canvasSize) {
    final tapPos = details.localPosition;
    final rotY = _currentRotY;
    final rotX = _rotationX;

    BrainNode? closest;
    double closestDist = double.infinity;

    for (final node in _service.filteredNodes) {
      final projected = _projectNode(
        node.x, node.y, node.z, rotY, rotX, canvasSize, _service.zoom,
      );
      final dist = (projected - tapPos).distance;
      if (dist < 30 && dist < closestDist) {
        closest = node;
        closestDist = dist;
      }
    }

    _service.selectNode(closest?.id);
  }

  static Offset _projectNode(
    double x, double y, double z,
    double rotY, double rotX,
    Size canvasSize, double zoom,
  ) {
    final cosY = cos(rotY);
    final sinY = sin(rotY);
    final rx = x * cosY + z * sinY;
    var ry = y;
    var rz = -x * sinY + z * cosY;
    final cosX = cos(rotX);
    final sinX = sin(rotX);
    final ry2 = ry * cosX - rz * sinX;
    final rz2 = ry * sinX + rz * cosX;
    ry = ry2;
    rz = rz2;
    const fov = 800.0;
    final scale = fov / (fov + rz);
    return Offset(
      canvasSize.width / 2 + rx * scale * zoom,
      canvasSize.height / 2 + ry * scale * zoom,
    );
  }

  // ── Stats bar ──────────────────────────────────────────────────────────

  Widget _buildStatsBar(bool isDark) {
    final stats = _service.graph!.stats;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.black.withValues(alpha: 0.03),
        border: Border(
          top: BorderSide(
            color: isDark ? Colors.white12 : Colors.black12,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _statItem('Memories', stats.totalMemories, isDark),
          _statItem('Entities', stats.kgEntities, isDark),
          _statItem('Emotions', stats.emotionalSamples, isDark),
          _statItem('Active', stats.activeCount, isDark),
          _statItem('Fading', stats.fadingCount, isDark),
        ],
      ),
    );
  }

  Widget _statItem(String label, int value, bool isDark) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$value',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 14,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: isDark ? Colors.white54 : Colors.black45,
          ),
        ),
      ],
    );
  }

  // ── Detail sheet ───────────────────────────────────────────────────────

  Widget _buildDetailSheet(bool isDark) {
    final node = _service.filteredNodes.cast<BrainNode?>().firstWhere(
          (n) => n?.id == _service.selectedNodeId,
          orElse: () => null,
        );
    if (node == null) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1e293b) : Colors.white,
        border: Border(
          top: BorderSide(color: _nodeColor(node.type).withValues(alpha: 0.4)),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: _nodeColor(node.type),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  node.label,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ),
              GestureDetector(
                onTap: () => _service.selectNode(null),
                child: Icon(
                  Icons.close,
                  size: 18,
                  color: isDark ? Colors.white38 : Colors.black38,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${node.type.name} · ${node.state.name} · strength ${(node.strength * 100).toInt()}%',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white54 : Colors.black45,
            ),
          ),
        ],
      ),
    );
  }

  // ── Color mapping ─────────────────────────────────────────────────────

  static Color _nodeColor(BrainNodeType type) {
    switch (type) {
      case BrainNodeType.memory:
        return const Color(0xFF3b82f6);
      case BrainNodeType.knowledge:
        return const Color(0xFF10b981);
      case BrainNodeType.emotion:
        return const Color(0xFFf59e0b);
      case BrainNodeType.reasoning:
        return const Color(0xFF8b5cf6);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// _Brain3DPainter — 3D perspective graph renderer with glow & particles
// ═══════════════════════════════════════════════════════════════════════════

class _Brain3DPainter extends CustomPainter {
  _Brain3DPainter({
    required this.nodes,
    required this.edges,
    required this.zoom,
    required this.rotationY,
    required this.rotationX,
    required this.selectedNodeId,
    required this.pulseValue,
    required this.particleValue,
    required this.isDark,
  });

  final List<BrainNode> nodes;
  final List<BrainEdge> edges;
  final double zoom;
  final double rotationY;
  final double rotationX;
  final String? selectedNodeId;
  final double pulseValue;
  final double particleValue;
  final bool isDark;

  static const double _fov = 800.0;

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final cosY = cos(rotationY);
    final sinY = sin(rotationY);
    final cosX = cos(rotationX);
    final sinX = sin(rotationX);

    // Project all nodes into screen space.
    final projected = <String, _Projected3D>{};
    for (final n in nodes) {
      projected[n.id] =
          _transform(n.x, n.y, n.z, cosY, sinY, cosX, sinX, cx, cy);
    }

    // ── Ambient glow background ──────────────────────────────────────
    if (isDark) {
      final bgGlow = Paint()
        ..shader = ui.Gradient.radial(
          Offset(cx, cy),
          size.shortestSide * 0.6,
          [
            const Color(0xFF1a1a3e).withValues(alpha: 0.5),
            const Color(0xFF0a0e1a).withValues(alpha: 0.0),
          ],
        );
      canvas.drawRect(Offset.zero & size, bgGlow);
    }

    // ── Draw edges with depth-based alpha ────────────────────────────
    for (final edge in edges) {
      final pa = projected[edge.source];
      final pb = projected[edge.target];
      if (pa == null || pb == null) continue;
      final avgDepth = (pa.depth + pb.depth) / 2;
      final depthAlpha = _depthAlpha(avgDepth) * 0.4;

      final edgePaint = Paint()
        ..color = (isDark ? Colors.white : Colors.blueGrey)
            .withValues(alpha: depthAlpha)
        ..strokeWidth = (0.5 + edge.weight * 0.8) * _depthScale(avgDepth)
        ..style = PaintingStyle.stroke;
      canvas.drawLine(pa.offset, pb.offset, edgePaint);

      // Animated particles along edge.
      _drawEdgeParticles(canvas, pa, pb, edge, avgDepth);
    }

    // ── Sort nodes back-to-front ─────────────────────────────────────
    final sortedNodes = List<BrainNode>.from(nodes);
    sortedNodes.sort((a, b) {
      return projected[b.id]!.depth.compareTo(projected[a.id]!.depth);
    });

    // ── Draw nodes ───────────────────────────────────────────────────
    for (final node in sortedNodes) {
      final p = projected[node.id]!;
      final color = _BrainPageState._nodeColor(node.type);
      final isSelected = node.id == selectedNodeId;
      final stateAlpha = _stateOpacity(node.state);
      final dScale = _depthScale(p.depth);
      final dAlpha = _depthAlpha(p.depth);
      final alpha = stateAlpha * dAlpha;

      final baseRadius = (6.0 + node.strength * 8.0) * dScale * zoom;
      final radius = isSelected
          ? baseRadius + 3 + pulseValue * 2
          : node.state == BrainNodeState.resonating
              ? baseRadius + pulseValue * 2
              : baseRadius;

      // ── Outer glow ─────────────────────────────────────────────
      if (isDark) {
        final glowR = radius * (isSelected ? 4.0 : 2.5);
        final glowA = (isSelected ? 0.4 : 0.15) * alpha;
        final glowPaint = Paint()
          ..shader = ui.Gradient.radial(
            p.offset,
            glowR,
            [
              color.withValues(alpha: glowA),
              color.withValues(alpha: 0.0),
            ],
          );
        canvas.drawCircle(p.offset, glowR, glowPaint);
      } else if (isSelected || node.state == BrainNodeState.resonating) {
        final glowPaint = Paint()
          ..shader = ui.Gradient.radial(
            p.offset,
            radius * 2.5,
            [
              color.withValues(alpha: 0.3 * alpha),
              color.withValues(alpha: 0.0),
            ],
          );
        canvas.drawCircle(p.offset, radius * 2.5, glowPaint);
      }

      // ── Node sphere fill with subtle gradient ──────────────────
      final fillPaint = Paint()
        ..shader = ui.Gradient.radial(
          p.offset + Offset(-radius * 0.3, -radius * 0.3),
          radius * 1.5,
          [
            color.withValues(alpha: alpha),
            color.withValues(alpha: alpha * 0.6),
          ],
        )
        ..style = PaintingStyle.fill;
      canvas.drawCircle(p.offset, radius, fillPaint);

      // ── Specular highlight ─────────────────────────────────────
      final highlightPaint = Paint()
        ..shader = ui.Gradient.radial(
          p.offset + Offset(-radius * 0.25, -radius * 0.25),
          radius * 0.6,
          [
            Colors.white.withValues(alpha: 0.35 * alpha),
            Colors.white.withValues(alpha: 0.0),
          ],
        );
      canvas.drawCircle(p.offset, radius, highlightPaint);

      // ── Stroke ring for fading / consolidating ─────────────────
      if (node.state == BrainNodeState.fading ||
          node.state == BrainNodeState.consolidating) {
        final strokePaint = Paint()
          ..color = color.withValues(alpha: 0.5 * dAlpha)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5 * dScale;
        canvas.drawCircle(p.offset, radius + 1.5, strokePaint);
      }

      // ── Label for selected node ────────────────────────────────
      if (isSelected) {
        final textPainter = TextPainter(
          text: TextSpan(
            text: node.label,
            style: TextStyle(
              fontSize: 11,
              color: isDark ? Colors.white : Colors.black87,
              fontWeight: FontWeight.w600,
              shadows: isDark
                  ? [Shadow(color: color.withValues(alpha: 0.6), blurRadius: 6)]
                  : null,
            ),
          ),
          textDirection: TextDirection.ltr,
        );
        textPainter.layout(maxWidth: 140);
        textPainter.paint(
          canvas,
          Offset(
            p.offset.dx - textPainter.width / 2,
            p.offset.dy + radius + 6,
          ),
        );
      }
    }
  }

  // ── 3D → 2D projection ────────────────────────────────────────────────

  _Projected3D _transform(
    double x, double y, double z,
    double cosY, double sinY, double cosX, double sinX,
    double cx, double cy,
  ) {
    // Rotate around Y.
    final rx = x * cosY + z * sinY;
    var ry = y;
    var rz = -x * sinY + z * cosY;
    // Rotate around X.
    final ry2 = ry * cosX - rz * sinX;
    final rz2 = ry * sinX + rz * cosX;
    ry = ry2;
    rz = rz2;
    // Perspective projection.
    final scale = _fov / (_fov + rz);
    return _Projected3D(
      offset: Offset(cx + rx * scale * zoom, cy + ry * scale * zoom),
      depth: rz,
    );
  }

  double _depthScale(double depth) {
    return (_fov / (_fov + depth)).clamp(0.3, 2.0);
  }

  double _depthAlpha(double depth) {
    return (1.0 - (depth / 800.0)).clamp(0.15, 1.0);
  }

  // ── Animated particles traveling along edges ──────────────────────────

  void _drawEdgeParticles(
    Canvas canvas,
    _Projected3D pa,
    _Projected3D pb,
    BrainEdge edge,
    double avgDepth,
  ) {
    final hash = (edge.source.hashCode ^ edge.target.hashCode) & 0x7FFFFFFF;
    final count = (edge.weight * 2).ceil().clamp(1, 3);
    final dAlpha = _depthAlpha(avgDepth);
    final dScale = _depthScale(avgDepth);

    for (var i = 0; i < count; i++) {
      final phase = ((hash + i * 137) % 1000) / 1000.0;
      final t = (particleValue + phase) % 1.0;
      final px = pa.offset.dx + (pb.offset.dx - pa.offset.dx) * t;
      final py = pa.offset.dy + (pb.offset.dy - pa.offset.dy) * t;

      final particlePaint = Paint()
        ..color = Colors.white.withValues(alpha: 0.6 * dAlpha)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(Offset(px, py), 1.5 * dScale, particlePaint);
    }
  }

  double _stateOpacity(BrainNodeState state) {
    switch (state) {
      case BrainNodeState.fresh:
        return 1.0;
      case BrainNodeState.active:
        return 0.9;
      case BrainNodeState.resonating:
        return 1.0;
      case BrainNodeState.fading:
        return 0.35;
      case BrainNodeState.consolidating:
        return 0.7;
      case BrainNodeState.consolidated:
        return 0.85;
    }
  }

  @override
  bool shouldRepaint(covariant _Brain3DPainter old) => true;
}

// ── Helper ───────────────────────────────────────────────────────────────

class _Projected3D {
  const _Projected3D({required this.offset, required this.depth});
  final Offset offset;
  final double depth;
}
