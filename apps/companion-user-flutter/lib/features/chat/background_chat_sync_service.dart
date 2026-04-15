import 'package:flutter/foundation.dart';

import '../../app/authenticated_client.dart';
import '../../app/dio_http_client.dart';
import '../../app/service_locator.dart';
import '../../features/auth/auth_service.dart';
import '../../features/auth/token_store.dart';
import 'chat_service.dart';
import 'messages_repository.dart';

abstract final class BackgroundChatSyncService {
  static Future<void> sync({String? chatId}) async {
    try {
      await setupServiceLocator();
      final repo = sl<MessagesRepository>();
      final auth = sl<AuthService>();
      final client = AuthenticatedClient(
        client: sl<DioHttpClient>(),
        tokenStore: sl<TokenStore>(),
        onTokenRefresh: () => auth.refresh(),
      );
      final chatService = ChatService(client: client, repo: repo);
      if (chatId != null && chatId.trim().isNotEmpty) {
        await chatService.listMessages(chatId.trim(), limit: 30);
        return;
      }
      final page = await chatService.listChats(limit: 10, offset: 0);
      for (final thread in page.threads.take(5)) {
        try {
          await chatService.listMessages(thread.id, limit: 20);
        } catch (e) {
          debugPrint('[BackgroundChatSync] thread ${thread.id} failed: $e');
        }
      }
    } catch (e) {
      // Best-effort background refresh only.
      debugPrint('[BackgroundChatSync] sync failed: $e');
    }
  }
}
