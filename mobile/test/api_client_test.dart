import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:roomie_mobile/api_client.dart';

void main() {
  test('parses roommate feed cards and their compatibility report', () async {
    final client = MockClient((request) async {
      expect(request.url.path, '/api/feed/user-1');
      return http.Response(
        jsonEncode({
          'cards': [
            {
              'id': 'candidate-1',
              'name': 'Mira',
              'age': 24,
              'occupation': 'Architect',
              'is_kyc_verified': true,
              'profile': {'food': 'veg'},
              'max_rent_budget': 16000,
              'commute_location': 'Bengaluru',
              'match_percentage': 91,
              'green_flags': ['Similar routine'],
              'potential_friction': ['Discuss guests'],
              'icebreakers': ['What do you like about your area?'],
            },
          ],
        }),
        200,
      );
    });
    final api = RoomieApiClient(
      baseUrl: 'https://api.example.test/',
      client: client,
    );

    final cards = await api.getFeed('user-1');

    expect(cards, hasLength(1));
    expect(cards.single.name, 'Mira');
    expect(cards.single.matchPercentage, 91);
    expect(cards.single.greenFlags, ['Similar routine']);
    expect(cards.single.profile['food'], 'veg');
  });

  test('surfaces API error details to the caller', () async {
    final client = MockClient(
      (_) async => http.Response(
        jsonEncode({'detail': 'Complete identity verification first.'}),
        403,
      ),
    );
    final api = RoomieApiClient(
      baseUrl: 'https://api.example.test',
      client: client,
    );

    await expectLater(
      api.getDemoUsers(),
      throwsA(
        isA<ApiException>().having(
          (error) => error.message,
          'message',
          'Complete identity verification first.',
        ),
      ),
    );
  });
}
