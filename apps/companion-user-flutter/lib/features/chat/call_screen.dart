import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/authenticated_client.dart';
import '../../app/sven_tokens.dart';
import 'call_service.dart';

/// Possible call states.
enum CallPhase { ringing, connecting, active, ended }

/// Full-screen call screen for voice/video calls.
class CallScreen extends StatefulWidget {
  const CallScreen({
    super.key,
    required this.client,
    required this.chatId,
    required this.callType,
    this.callId,
    this.isIncoming = false,
    this.callerName,
    this.visualMode = VisualMode.cinematic,
  });

  final AuthenticatedClient client;
  final String chatId;

  /// 'audio' or 'video'.
  final String callType;

  /// If joining an existing call; null to start a new one.
  final String? callId;
  final bool isIncoming;
  final String? callerName;
  final VisualMode visualMode;

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> with TickerProviderStateMixin {
  late final CallService _callService;
  late final AnimationController _pulseController;
  Timer? _durationTimer;

  CallPhase _phase = CallPhase.ringing;
  String? _callId;
  bool _micMuted = false;
  bool _videoEnabled = false;
  bool _speakerOn = false;
  Duration _elapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _callService = CallService(client: widget.client);
    _videoEnabled = widget.callType == 'video';

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    if (widget.isIncoming) {
      _callId = widget.callId;
    } else {
      _initiateCall();
    }

    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _durationTimer?.cancel();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  Future<void> _initiateCall() async {
    final result = await _callService.startCall(
      widget.chatId,
      type: widget.callType,
    );
    if (!mounted) return;
    if (result != null) {
      setState(() {
        _callId = result.callId;
        _phase = CallPhase.connecting;
      });
      _startDurationTimer();
    } else {
      setState(() => _phase = CallPhase.ended);
    }
  }

  Future<void> _acceptCall() async {
    if (_callId == null) return;
    final result = await _callService.joinCall(_callId!);
    if (!mounted) return;
    if (result != null) {
      setState(() => _phase = CallPhase.active);
      _startDurationTimer();
    }
  }

  Future<void> _declineCall() async {
    if (_callId != null) {
      await _callService.declineCall(_callId!);
    }
    if (mounted) {
      setState(() => _phase = CallPhase.ended);
      _popAfterDelay();
    }
  }

  Future<void> _endCall() async {
    if (_callId != null) {
      await _callService.leaveCall(_callId!);
    }
    if (mounted) {
      setState(() => _phase = CallPhase.ended);
      _popAfterDelay();
    }
  }

  void _toggleMic() async {
    final next = !_micMuted;
    if (_callId != null) {
      await _callService.updateMediaState(
        _callId!,
        audio: !next,
        video: _videoEnabled,
      );
    }
    if (mounted) setState(() => _micMuted = next);
  }

  void _toggleVideo() async {
    final next = !_videoEnabled;
    if (_callId != null) {
      await _callService.updateMediaState(
        _callId!,
        audio: !_micMuted,
        video: next,
      );
    }
    if (mounted) setState(() => _videoEnabled = next);
  }

  void _toggleSpeaker() {
    setState(() => _speakerOn = !_speakerOn);
  }

  void _startDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _elapsed += const Duration(seconds: 1));
      }
    });
  }

  void _popAfterDelay() {
    _durationTimer?.cancel();
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) Navigator.of(context).pop();
    });
  }

  String _formatDuration(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return h > 0 ? '$h:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final tok = SvenTokens.forMode(widget.visualMode);

    return Scaffold(
      backgroundColor: tok.scaffold,
      body: Container(
        decoration: BoxDecoration(gradient: tok.backgroundGradient),
        child: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: 40),
              _buildAvatar(tok),
              const SizedBox(height: 24),
              _buildCallerInfo(tok),
              const SizedBox(height: 12),
              _buildStatus(tok),
              const Spacer(),
              _buildControls(tok),
              const SizedBox(height: 48),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar(SvenModeTokens tok) {
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        final scale = _phase == CallPhase.ringing
            ? 1.0 + _pulseController.value * 0.08
            : 1.0;
        return Transform.scale(
          scale: scale,
          child: Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: tok.primary.withValues(alpha: 0.15),
              border: Border.all(color: tok.primary, width: 3),
              boxShadow: [
                BoxShadow(
                  color: tok.glow,
                  blurRadius: 30,
                  spreadRadius: 8,
                ),
              ],
            ),
            child: Icon(
              _videoEnabled ? Icons.videocam : Icons.person,
              size: 56,
              color: tok.primary,
            ),
          ),
        );
      },
    );
  }

  Widget _buildCallerInfo(SvenModeTokens tok) {
    return Column(
      children: [
        Text(
          widget.callerName ?? 'Sven',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            color: tok.onSurface,
          ),
        ),
        if (_phase == CallPhase.active) ...[
          const SizedBox(height: 4),
          Text(
            _formatDuration(_elapsed),
            style: TextStyle(
              fontSize: 16,
              color: tok.onSurface.withValues(alpha: 0.6),
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildStatus(SvenModeTokens tok) {
    final text = switch (_phase) {
      CallPhase.ringing =>
        widget.isIncoming ? 'Incoming call...' : 'Calling...',
      CallPhase.connecting => 'Connecting...',
      CallPhase.active =>
        widget.callType == 'video' ? 'Video call' : 'Voice call',
      CallPhase.ended => 'Call ended',
    };

    return Text(
      text,
      style: TextStyle(
        fontSize: 14,
        color: tok.onSurface.withValues(alpha: 0.5),
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildControls(SvenModeTokens tok) {
    if (_phase == CallPhase.ended) {
      return const SizedBox.shrink();
    }

    if (_phase == CallPhase.ringing && widget.isIncoming) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _controlButton(
            icon: Icons.call_end,
            label: 'Decline',
            color: tok.error,
            onTap: _declineCall,
            tok: tok,
          ),
          _controlButton(
            icon: Icons.call,
            label: 'Accept',
            color: tok.success,
            onTap: _acceptCall,
            tok: tok,
          ),
        ],
      );
    }

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _controlButton(
              icon: _micMuted ? Icons.mic_off : Icons.mic,
              label: _micMuted ? 'Unmute' : 'Mute',
              color:
                  _micMuted ? tok.error : tok.onSurface.withValues(alpha: 0.7),
              onTap: _toggleMic,
              tok: tok,
              small: true,
            ),
            _controlButton(
              icon: _videoEnabled ? Icons.videocam : Icons.videocam_off,
              label: _videoEnabled ? 'Camera' : 'Camera Off',
              color: _videoEnabled
                  ? tok.primary
                  : tok.onSurface.withValues(alpha: 0.7),
              onTap: _toggleVideo,
              tok: tok,
              small: true,
            ),
            _controlButton(
              icon: _speakerOn ? Icons.volume_up : Icons.volume_down,
              label: _speakerOn ? 'Speaker' : 'Earpiece',
              color: _speakerOn
                  ? tok.primary
                  : tok.onSurface.withValues(alpha: 0.7),
              onTap: _toggleSpeaker,
              tok: tok,
              small: true,
            ),
          ],
        ),
        const SizedBox(height: 28),
        _controlButton(
          icon: Icons.call_end,
          label: 'End',
          color: tok.error,
          onTap: _endCall,
          tok: tok,
        ),
      ],
    );
  }

  Widget _controlButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
    required SvenModeTokens tok,
    bool small = false,
  }) {
    final size = small ? 52.0 : 64.0;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          onTap: onTap,
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withValues(alpha: 0.2),
              border: Border.all(color: color.withValues(alpha: 0.5)),
            ),
            child: Icon(icon, color: color, size: size * 0.45),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: tok.onSurface.withValues(alpha: 0.6),
          ),
        ),
      ],
    );
  }
}
