// ═══════════════════════════════════════════════════════════════════════════
// Trading models — data classes for the Sven Trading API surface.
//
// Uses plain Dart classes (no code-gen) to match existing service patterns.
// All JSON factories follow gateway-api response shapes exactly.
// ═══════════════════════════════════════════════════════════════════════════

/// Sven's current trading status.
class TradingStatus {
  final String state;
  final String? activeSymbol;
  final int openPositions;
  final int pendingOrders;
  final double todayPnl;
  final int todayTrades;
  final double uptime;
  final String? lastLoopAt;
  final String? lastDecision;
  final CircuitBreakerState circuitBreaker;
  final String mode;
  final LoopInfo loop;
  final BrainInfo brain;
  final AutoTradeInfo autoTrade;
  final MessagingInfo messaging;

  const TradingStatus({
    required this.state,
    this.activeSymbol,
    required this.openPositions,
    required this.pendingOrders,
    required this.todayPnl,
    required this.todayTrades,
    required this.uptime,
    this.lastLoopAt,
    this.lastDecision,
    required this.circuitBreaker,
    required this.mode,
    required this.loop,
    required this.brain,
    required this.autoTrade,
    required this.messaging,
  });

  factory TradingStatus.fromJson(Map<String, dynamic> j) => TradingStatus(
        state: j['state'] as String? ?? 'offline',
        activeSymbol: j['activeSymbol'] as String?,
        openPositions: (j['openPositions'] as num?)?.toInt() ?? 0,
        pendingOrders: (j['pendingOrders'] as num?)?.toInt() ?? 0,
        todayPnl: (j['todayPnl'] as num?)?.toDouble() ?? 0,
        todayTrades: (j['todayTrades'] as num?)?.toInt() ?? 0,
        uptime: (j['uptime'] as num?)?.toDouble() ?? 0,
        lastLoopAt: j['lastLoopAt'] as String?,
        lastDecision: j['lastDecision'] as String?,
        circuitBreaker: CircuitBreakerState.fromJson(
            j['circuitBreaker'] as Map<String, dynamic>? ?? {}),
        mode: j['mode'] as String? ?? 'paper',
        loop: LoopInfo.fromJson(j['loop'] as Map<String, dynamic>? ?? {}),
        brain: BrainInfo.fromJson(j['brain'] as Map<String, dynamic>? ?? {}),
        autoTrade: AutoTradeInfo.fromJson(
            j['autoTrade'] as Map<String, dynamic>? ?? {}),
        messaging: MessagingInfo.fromJson(
            j['messaging'] as Map<String, dynamic>? ?? {}),
      );
}

class CircuitBreakerState {
  final bool tripped;
  final String? reason;
  final double dailyLossPct;
  final double dailyLossLimit;

  const CircuitBreakerState({
    required this.tripped,
    this.reason,
    required this.dailyLossPct,
    required this.dailyLossLimit,
  });

  factory CircuitBreakerState.fromJson(Map<String, dynamic> j) =>
      CircuitBreakerState(
        tripped: j['tripped'] as bool? ?? false,
        reason: j['reason'] as String?,
        dailyLossPct: (j['dailyLossPct'] as num?)?.toDouble() ?? 0,
        dailyLossLimit: (j['dailyLossLimit'] as num?)?.toDouble() ?? 0.05,
      );
}

class LoopInfo {
  final bool running;
  final int intervalMs;
  final int iterations;
  final List<String> trackedSymbols;

  const LoopInfo({
    required this.running,
    required this.intervalMs,
    required this.iterations,
    required this.trackedSymbols,
  });

  factory LoopInfo.fromJson(Map<String, dynamic> j) => LoopInfo(
        running: j['running'] as bool? ?? false,
        intervalMs: (j['intervalMs'] as num?)?.toInt() ?? 60000,
        iterations: (j['iterations'] as num?)?.toInt() ?? 0,
        trackedSymbols: (j['trackedSymbols'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            [],
      );
}

class BrainInfo {
  final List<GpuNode> fleet;
  final double escalationThreshold;

  const BrainInfo({
    required this.fleet,
    required this.escalationThreshold,
  });

  factory BrainInfo.fromJson(Map<String, dynamic> j) => BrainInfo(
        fleet: (j['fleet'] as List<dynamic>?)
                ?.map((e) => GpuNode.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        escalationThreshold:
            (j['escalationThreshold'] as num?)?.toDouble() ?? 0.55,
      );
}

class GpuNode {
  final String name;
  final String role;
  final String model;
  final bool healthy;

  const GpuNode({
    required this.name,
    required this.role,
    required this.model,
    required this.healthy,
  });

  factory GpuNode.fromJson(Map<String, dynamic> j) => GpuNode(
        name: j['name'] as String? ?? '',
        role: j['role'] as String? ?? '',
        model: j['model'] as String? ?? '',
        healthy: j['healthy'] as bool? ?? false,
      );
}

class AutoTradeInfo {
  final bool enabled;
  final double confidenceThreshold;
  final double maxPositionPct;
  final int totalExecuted;
  final Map<String, dynamic>? lastTrade;

  const AutoTradeInfo({
    required this.enabled,
    required this.confidenceThreshold,
    required this.maxPositionPct,
    required this.totalExecuted,
    this.lastTrade,
  });

  factory AutoTradeInfo.fromJson(Map<String, dynamic> j) => AutoTradeInfo(
        enabled: j['enabled'] as bool? ?? false,
        confidenceThreshold:
            (j['confidenceThreshold'] as num?)?.toDouble() ?? 0.6,
        maxPositionPct: (j['maxPositionPct'] as num?)?.toDouble() ?? 0.05,
        totalExecuted: (j['totalExecuted'] as num?)?.toInt() ?? 0,
        lastTrade: j['lastTrade'] as Map<String, dynamic>?,
      );
}

class MessagingInfo {
  final int unreadCount;
  final int totalMessages;
  final int scheduledPending;

  const MessagingInfo({
    required this.unreadCount,
    required this.totalMessages,
    required this.scheduledPending,
  });

  factory MessagingInfo.fromJson(Map<String, dynamic> j) => MessagingInfo(
        unreadCount: (j['unreadCount'] as num?)?.toInt() ?? 0,
        totalMessages: (j['totalMessages'] as num?)?.toInt() ?? 0,
        scheduledPending: (j['scheduledPending'] as num?)?.toInt() ?? 0,
      );
}

/// A proactive message from Sven.
class SvenMessage {
  final String id;
  final String type; // 'trade_alert' | 'market_insight' | 'scheduled' | 'system'
  final String title;
  final String body;
  final String? symbol;
  final String severity; // 'info' | 'warning' | 'critical'
  final bool read;
  final String createdAt;

  const SvenMessage({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.symbol,
    required this.severity,
    required this.read,
    required this.createdAt,
  });

  factory SvenMessage.fromJson(Map<String, dynamic> j) => SvenMessage(
        id: j['id'] as String? ?? '',
        type: j['type'] as String? ?? 'system',
        title: j['title'] as String? ?? '',
        body: j['body'] as String? ?? '',
        symbol: j['symbol'] as String?,
        severity: j['severity'] as String? ?? 'info',
        read: j['read'] as bool? ?? false,
        createdAt: j['createdAt'] as String? ?? '',
      );
}

/// A trade executed by Sven.
class SvenTrade {
  final String symbol;
  final String side;
  final double quantity;
  final double price;
  final double confidence;
  final String broker;
  final String timestamp;

  const SvenTrade({
    required this.symbol,
    required this.side,
    required this.quantity,
    required this.price,
    required this.confidence,
    required this.broker,
    required this.timestamp,
  });

  factory SvenTrade.fromJson(Map<String, dynamic> j) => SvenTrade(
        symbol: j['symbol'] as String? ?? '',
        side: j['side'] as String? ?? '',
        quantity: (j['quantity'] as num?)?.toDouble() ?? 0,
        price: (j['price'] as num?)?.toDouble() ?? 0,
        confidence: (j['confidence'] as num?)?.toDouble() ?? 0,
        broker: j['broker'] as String? ?? 'paper',
        timestamp: j['timestamp'] as String? ?? '',
      );
}

/// SSE event from the trading stream.
class TradingEvent {
  final String id;
  final String type;
  final DateTime timestamp;
  final Map<String, dynamic> data;

  const TradingEvent({
    required this.id,
    required this.type,
    required this.timestamp,
    required this.data,
  });

  factory TradingEvent.fromJson(Map<String, dynamic> j) => TradingEvent(
        id: j['id'] as String? ?? '',
        type: j['type'] as String? ?? '',
        timestamp: DateTime.tryParse(j['timestamp'] as String? ?? '') ??
            DateTime.now(),
        data: j['data'] as Map<String, dynamic>? ?? {},
      );
}

/// An open market position held by Sven.
class Position {
  final String id;
  final String symbol;
  final String side; // 'long' | 'short'
  final double quantity;
  final double entryPrice;
  final double currentPrice;
  final double unrealizedPnl;
  final String broker;
  final String openedAt;
  final List<double> priceHistory;

  const Position({
    required this.id,
    required this.symbol,
    required this.side,
    required this.quantity,
    required this.entryPrice,
    required this.currentPrice,
    required this.unrealizedPnl,
    required this.broker,
    required this.openedAt,
    this.priceHistory = const [],
  });

  factory Position.fromJson(Map<String, dynamic> j) => Position(
        id: j['id'] as String? ?? '',
        symbol: j['symbol'] as String? ?? '',
        side: j['side'] as String? ?? 'long',
        quantity: (j['quantity'] as num?)?.toDouble() ?? 0,
        entryPrice: (j['entryPrice'] as num?)?.toDouble() ?? 0,
        currentPrice: (j['currentPrice'] as num?)?.toDouble() ?? 0,
        unrealizedPnl: (j['unrealizedPnl'] as num?)?.toDouble() ?? 0,
        broker: j['broker'] as String? ?? '',
        openedAt: j['openedAt'] as String? ?? '',
        priceHistory: (j['priceHistory'] as List<dynamic>?)
                ?.map((e) => (e as num).toDouble())
                .toList() ??
            [],
      );
}

/// A price threshold alert configured by the user.
class PriceAlert {
  final String id;
  final String symbol;
  final double targetPrice;
  final String direction; // 'above' | 'below'
  final String status; // 'active' | 'triggered' | 'expired'
  final String createdAt;

  const PriceAlert({
    required this.id,
    required this.symbol,
    required this.targetPrice,
    required this.direction,
    required this.status,
    required this.createdAt,
  });

  factory PriceAlert.fromJson(Map<String, dynamic> j) => PriceAlert(
        id: j['id'] as String? ?? '',
        symbol: j['symbol'] as String? ?? '',
        targetPrice: (j['targetPrice'] as num?)?.toDouble() ?? 0,
        direction: j['direction'] as String? ?? 'above',
        status: j['status'] as String? ?? 'active',
        createdAt: j['createdAt'] as String? ?? '',
      );
}
