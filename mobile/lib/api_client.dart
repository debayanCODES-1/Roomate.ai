import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  const ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class DemoUser {
  const DemoUser({
    required this.id,
    required this.name,
    required this.gender,
    required this.allowCoedLiving,
  });

  final String id;
  final String name;
  final String gender;
  final bool allowCoedLiving;

  factory DemoUser.fromJson(Map<String, dynamic> json) => DemoUser(
        id: json['id'] as String,
        name: json['name'] as String,
        gender: json['gender'] as String? ?? 'woman',
        allowCoedLiving: json['allow_coed_living'] as bool? ?? false,
      );

  DemoUser copyWith({bool? allowCoedLiving}) => DemoUser(
        id: id,
        name: name,
        gender: gender,
        allowCoedLiving: allowCoedLiving ?? this.allowCoedLiving,
      );
}

class RoommateCard {
  const RoommateCard({
    required this.id,
    required this.name,
    required this.occupation,
    required this.age,
    required this.verified,
    required this.profile,
    required this.maxRentBudget,
    required this.commuteLocation,
    required this.matchPercentage,
    required this.greenFlags,
    required this.potentialFriction,
    required this.icebreakers,
  });

  final String id;
  final String name;
  final String occupation;
  final int? age;
  final bool verified;
  final Map<String, dynamic> profile;
  final int maxRentBudget;
  final String commuteLocation;
  final int matchPercentage;
  final List<String> greenFlags;
  final List<String> potentialFriction;
  final List<String> icebreakers;

  factory RoommateCard.fromJson(Map<String, dynamic> json) => RoommateCard(
        id: json['id'] as String,
        name: json['name'] as String? ?? 'Roommate',
        occupation: json['occupation'] as String? ?? 'Occupation not shared',
        age: json['age'] as int?,
        verified: json['is_kyc_verified'] as bool? ?? false,
        profile: _asMap(json['profile']),
        maxRentBudget: json['max_rent_budget'] as int? ?? 0,
        commuteLocation: json['commute_location'] as String? ?? '',
        matchPercentage: json['match_percentage'] as int? ?? 0,
        greenFlags: _asStringList(json['green_flags']),
        potentialFriction: _asStringList(json['potential_friction']),
        icebreakers: _asStringList(json['icebreakers']),
      );
}

class RoommateMatch {
  const RoommateMatch({
    required this.chatRoomId,
    required this.userId,
    required this.name,
    required this.age,
    required this.occupation,
    required this.matchPercentage,
    required this.icebreakers,
  });

  final String chatRoomId;
  final String userId;
  final String name;
  final int? age;
  final String occupation;
  final int matchPercentage;
  final List<String> icebreakers;

  factory RoommateMatch.fromJson(Map<String, dynamic> json) {
    final user = _asMap(json['user']);
    final report = _asMap(json['compatibility_report']);
    return RoommateMatch(
      chatRoomId: json['chat_room_id'] as String,
      userId: user['id'] as String? ?? '',
      name: user['name'] as String? ?? 'Roommate',
      age: user['age'] as int?,
      occupation: user['occupation'] as String? ?? 'Occupation not shared',
      matchPercentage: report['match_percentage'] as int? ?? 0,
      icebreakers: _asStringList(report['icebreakers']),
    );
  }
}

class SwipeResult {
  const SwipeResult({required this.isMutualMatch, required this.icebreakers});

  final bool isMutualMatch;
  final List<String> icebreakers;

  factory SwipeResult.fromJson(Map<String, dynamic> json) {
    final match = _asMap(json['match']);
    final report = _asMap(match['compatibility_report']);
    return SwipeResult(
      isMutualMatch: json['is_mutual_match'] as bool? ?? false,
      icebreakers: _asStringList(report['icebreakers']),
    );
  }
}

class RoomieApiClient {
  RoomieApiClient({String? baseUrl, http.Client? client})
      : baseUrl = (baseUrl ??
                const String.fromEnvironment(
                  'API_BASE_URL',
                  defaultValue: 'http://10.0.2.2:8000',
                ))
            .replaceFirst(RegExp(r'/+$'), ''),
        _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  Future<List<DemoUser>> getDemoUsers() async {
    final result = await _request('GET', '/api/demo/users');
    if (result is! List) {
      throw const ApiException('The API returned an invalid user list.');
    }
    return result
        .whereType<Map<String, dynamic>>()
        .map(DemoUser.fromJson)
        .toList();
  }

  Future<List<RoommateCard>> getFeed(String userId) async {
    final result = await _request('GET', '/api/feed/$userId');
    final cards = _asMap(result)['cards'];
    if (cards is! List) {
      throw const ApiException('The API returned an invalid roommate feed.');
    }
    return cards
        .whereType<Map<String, dynamic>>()
        .map(RoommateCard.fromJson)
        .toList();
  }

  Future<List<RoommateMatch>> getMatches(String userId) async {
    final result = await _request('GET', '/api/matches/$userId');
    final matches = _asMap(result)['matches'];
    if (matches is! List) {
      throw const ApiException('The API returned an invalid matches list.');
    }
    return matches
        .whereType<Map<String, dynamic>>()
        .map(RoommateMatch.fromJson)
        .toList();
  }

  Future<SwipeResult> swipe({
    required String userId,
    required String candidateId,
    required bool liked,
  }) async {
    final result = await _request(
      'POST',
      '/api/swipe',
      body: {'swiper_id': userId, 'candidate_id': candidateId, 'liked': liked},
    );
    return SwipeResult.fromJson(_asMap(result));
  }

  Future<String> updateProfile({
    required String userId,
    required String message,
  }) async {
    final result = _asMap(
      await _request(
        'POST',
        '/api/onboard/chat',
        body: {'user_id': userId, 'message': message},
      ),
    );
    final reply = result['assistant_reply'];
    if (reply is! String || reply.isEmpty) {
      throw const ApiException('The API did not return a profile update.');
    }
    return reply;
  }

  Future<void> updateCoedPreference({
    required String userId,
    required bool allowCoed,
  }) async {
    await _request(
      'PUT',
      '/api/preferences/$userId',
      body: {
        'allow_coed_living': allowCoed,
        'min_rent_budget': 10000,
        'max_rent_budget': 18000,
        'deposit_budget': 40000,
        'utilities_share': true,
        'commute_location': 'Bengaluru',
        'max_commute_km': 15,
      },
    );
  }

  Future<void> verifySandbox({
    required String userId,
    required String gender,
    required int age,
  }) async {
    await _request(
      'POST',
      '/api/kyc/verify',
      body: {
        'user_id': userId,
        'authorization_code':
            'sandbox-${DateTime.now().microsecondsSinceEpoch}',
        'sandbox_gender': gender,
        'sandbox_age': age,
      },
    );
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = switch (method) {
      'GET' => await _client.get(uri).timeout(const Duration(seconds: 20)),
      'POST' => await _client
          .post(uri, headers: _jsonHeaders, body: jsonEncode(body))
          .timeout(const Duration(seconds: 20)),
      'PUT' => await _client
          .put(uri, headers: _jsonHeaders, body: jsonEncode(body))
          .timeout(const Duration(seconds: 20)),
      _ => throw ArgumentError.value(
          method,
          'method',
          'Unsupported HTTP method',
        ),
    };

    dynamic decoded;
    try {
      decoded = response.body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(response.body);
    } on FormatException {
      throw ApiException(
        'The API returned invalid JSON (${response.statusCode}).',
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final detail = decoded is Map<String, dynamic> ? decoded['detail'] : null;
      throw ApiException(
        detail is String && detail.isNotEmpty
            ? detail
            : 'Request failed (${response.statusCode}).',
      );
    }
    return decoded;
  }

  static const _jsonHeaders = {'Content-Type': 'application/json'};
}

Map<String, dynamic> _asMap(dynamic value) =>
    value is Map<String, dynamic> ? value : <String, dynamic>{};

List<String> _asStringList(dynamic value) =>
    value is List ? value.whereType<String>().toList() : <String>[];
