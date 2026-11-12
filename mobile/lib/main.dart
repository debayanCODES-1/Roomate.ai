import 'package:material_ui/material_ui.dart';

import 'api_client.dart';

const _forest = Color(0xFF315C45);
const _sage = Color(0xFFEAF0E9);
const _paper = Color(0xFFF7F6F0);
const _citrus = Color(0xFFE8E8A8);

void main() {
  runApp(const RoomieApp());
}

class RoomieApp extends StatelessWidget {
  const RoomieApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Roomie',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          scaffoldBackgroundColor: _paper,
          colorScheme: ColorScheme.fromSeed(
            seedColor: _forest,
            primary: _forest,
            surface: _paper,
          ),
          appBarTheme: const AppBarTheme(
            backgroundColor: _paper,
            foregroundColor: Color(0xFF24332A),
            surfaceTintColor: Colors.transparent,
          ),
        ),
        home: const RoomieHomePage(),
      );
}

class RoomieHomePage extends StatefulWidget {
  const RoomieHomePage({super.key});

  @override
  State<RoomieHomePage> createState() => _RoomieHomePageState();
}

class _RoomieHomePageState extends State<RoomieHomePage> {
  final _api = RoomieApiClient();
  List<DemoUser> _users = const [];
  List<RoommateCard> _cards = const [];
  List<RoommateMatch> _matches = const [];
  DemoUser? _user;
  bool _allowCoed = false;
  String _sandboxGender = 'woman';
  double _sandboxAge = 25;
  bool _loading = true;
  bool _busy = false;
  int _tabIndex = 0;
  String? _error;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final users = await _api.getDemoUsers();
      if (!mounted) return;
      setState(() {
        _users = users;
        _user = users.isEmpty ? null : users.first;
        _allowCoed = _user?.allowCoedLiving ?? false;
        _sandboxGender = _user?.gender ?? 'woman';
      });
      if (_user != null) await _refreshUserData();
    } on Exception catch (error) {
      _setError(error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _refreshUserData() async {
    final user = _user;
    if (user == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final cards = await _api.getFeed(user.id);
      final matches = await _api.getMatches(user.id);
      if (!mounted || _user?.id != user.id) return;
      setState(() {
        _cards = cards;
        _matches = matches;
      });
    } on Exception catch (error) {
      _setError(error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _setError(Object error) {
    if (!mounted) return;
    setState(() => _error = error.toString());
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _selectUser(DemoUser? user) async {
    if (user == null) return;
    setState(() {
      _user = user;
      _allowCoed = user.allowCoedLiving;
      _sandboxGender = user.gender;
      _cards = const [];
      _matches = const [];
    });
    await _refreshUserData();
  }

  Future<void> _swipe(RoommateCard card, bool liked) async {
    final user = _user;
    if (user == null || _busy) return;
    setState(() => _busy = true);
    try {
      final result = await _api.swipe(
        userId: user.id,
        candidateId: card.id,
        liked: liked,
      );
      if (!mounted) return;
      if (result.isMutualMatch) {
        await _showMatch(card.name, result.icebreakers);
      } else {
        _showMessage(liked ? 'Like sent to ${card.name}.' : 'Profile passed.');
      }
      await _refreshUserData();
    } on Exception catch (error) {
      _setError(error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _showMatch(String name, List<String> icebreakers) async {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.favorite, color: _forest, size: 34),
        title: Text('You and $name clicked!'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('A few ideas to start a conversation:'),
            const SizedBox(height: 12),
            ...icebreakers.map(
              (line) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text('“$line”'),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  Future<void> _updateCoed(bool value) async {
    final user = _user;
    if (user == null) return;
    final previous = _allowCoed;
    setState(() {
      _allowCoed = value;
      _busy = true;
    });
    try {
      await _api.updateCoedPreference(userId: user.id, allowCoed: value);
      if (!mounted) return;
      final updatedUser = user.copyWith(allowCoedLiving: value);
      setState(() {
        _user = updatedUser;
        _users = _users
            .map((item) => item.id == updatedUser.id ? updatedUser : item)
            .toList();
      });
      _showMessage(
        value
            ? 'Co-ed matching is on. Both people must opt in.'
            : 'Co-ed matching is off.',
      );
      await _refreshUserData();
    } on Exception catch (error) {
      if (mounted) setState(() => _allowCoed = previous);
      _setError(error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openOnboarding() async {
    final user = _user;
    if (user == null) return;
    final message = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _OnboardingSheet(name: user.name),
    );
    if (message == null || message.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      final reply = await _api.updateProfile(userId: user.id, message: message);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Profile updated'),
          content: Text(reply),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Done'),
            ),
          ],
        ),
      );
      await _refreshUserData();
    } on Exception catch (error) {
      _setError(error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _runSandboxVerification() async {
    final user = _user;
    if (user == null) return;
    setState(() => _busy = true);
    try {
      await _api.verifySandbox(
        userId: user.id,
        gender: _sandboxGender,
        age: _sandboxAge.round(),
      );
      if (!mounted) return;
      _showMessage(
        'Sandbox check complete. This does not verify a real identity.',
      );
      await _refreshUserData();
    } on Exception catch (error) {
      _setError(error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'roomie.',
          style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: -1),
        ),
        actions: [
          if (_users.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<DemoUser>(
                  value: user,
                  borderRadius: BorderRadius.circular(16),
                  onChanged: _busy ? null : _selectUser,
                  items: _users
                      .map(
                        (item) => DropdownMenuItem(
                          value: item,
                          child: Text('As ${item.name}'),
                        ),
                      )
                      .toList(),
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: _loading && _users.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _users.isEmpty
                ? _ConnectionError(message: _error!, onRetry: _initialize)
                : user == null
                    ? _EmptyUsers(onRetry: _initialize)
                    : Column(
                        children: [
                          if (_error != null)
                            _InlineError(
                                message: _error!, onRetry: _refreshUserData),
                          Expanded(
                            child: IndexedStack(
                              index: _tabIndex,
                              children: [
                                _buildBrowseTab(user),
                                _buildMatchesTab(),
                                _buildProfileTab(user),
                              ],
                            ),
                          ),
                        ],
                      ),
      ),
      bottomNavigationBar: user == null
          ? null
          : NavigationBar(
              selectedIndex: _tabIndex,
              onDestinationSelected: (index) {
                setState(() => _tabIndex = index);
                if (index == 1) _refreshMatches();
              },
              destinations: [
                const NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home),
                  label: 'Discover',
                ),
                NavigationDestination(
                  icon: const Icon(Icons.favorite_border),
                  selectedIcon: const Icon(Icons.favorite),
                  label:
                      'Matches${_matches.isEmpty ? '' : ' (${_matches.length})'}',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  selectedIcon: Icon(Icons.person),
                  label: 'Profile',
                ),
              ],
            ),
    );
  }

  Widget _buildBrowseTab(DemoUser user) {
    final card = _cards.isEmpty ? null : _cards.first;
    return RefreshIndicator(
      onRefresh: _refreshUserData,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0x1F315C45)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.verified_user_outlined, color: _forest, size: 17),
                SizedBox(width: 8),
                Text(
                  'THOUGHTFUL MATCHES, SAFER HOMES',
                  style: TextStyle(
                    color: _forest,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Find your kind\nof home.',
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  height: 1.03,
                  letterSpacing: -1.5,
                ),
          ),
          const SizedBox(height: 12),
          Text(
            'Meet verified people whose routines, budgets, and idea of a happy home fit yours.',
            style: Theme.of(context)
                .textTheme
                .bodyLarge
                ?.copyWith(color: Colors.black54, height: 1.5),
          ),
          const SizedBox(height: 22),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const CircleAvatar(
                    backgroundColor: _sage,
                    foregroundColor: _forest,
                    child: Icon(Icons.shield_outlined),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Verified people, first',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                        SizedBox(height: 3),
                        Text(
                          'Identity and preference checks help guide your feed.',
                          style: TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  Column(
                    children: [
                      const Text('Co-ed', style: TextStyle(fontSize: 11)),
                      Switch.adaptive(
                        value: _allowCoed,
                        onChanged: _busy ? null : _updateCoed,
                        activeTrackColor: _forest,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Roommates for you',
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              IconButton(
                tooltip: 'Refresh feed',
                onPressed: _loading ? null : _refreshUserData,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          if (_loading && card == null)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (card == null)
            _NoProfiles(onRefresh: _refreshUserData)
          else ...[
            _RoommateCardView(card: card),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _SwipeButton(
                  icon: Icons.close,
                  label: 'Pass',
                  color: const Color(0xFFB3434C),
                  onPressed: _busy ? null : () => _swipe(card, false),
                ),
                const SizedBox(width: 20),
                _SwipeButton(
                  icon: Icons.favorite,
                  label: 'Like',
                  color: _forest,
                  onPressed: _busy ? null : () => _swipe(card, true),
                ),
              ],
            ),
          ],
          const SizedBox(height: 20),
          Card(
            color: _sage,
            child: ListTile(
              leading: const CircleAvatar(
                backgroundColor: Colors.white,
                foregroundColor: _forest,
                child: Icon(Icons.auto_awesome),
              ),
              title: const Text(
                'Tell Roomie how you live',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: const Text('Update your routine and preferences'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _busy ? null : _openOnboarding,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Browsing as ${user.name}',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, color: Colors.black45),
          ),
        ],
      ),
    );
  }

  Widget _buildMatchesTab() => RefreshIndicator(
        onRefresh: _refreshMatches,
        child: _matches.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(28),
                children: const [
                  SizedBox(height: 90),
                  Icon(Icons.favorite_border, size: 52, color: _forest),
                  SizedBox(height: 18),
                  Text(
                    'Your matches will show up here',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'When both people like each other, you’ll see a mutual match and conversation starters.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.black54, height: 1.5),
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.all(20),
                itemCount: _matches.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final match = _matches[index];
                  return Card(
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(14),
                      leading: CircleAvatar(
                        backgroundColor: _citrus,
                        foregroundColor: _forest,
                        child: Text(match.name.characters.first.toUpperCase()),
                      ),
                      title: Text(
                        match.age == null
                            ? match.name
                            : '${match.name}, ${match.age}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        '${match.occupation}\n${match.matchPercentage}% compatibility',
                      ),
                      isThreeLine: true,
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => _showMatch(match.name, match.icebreakers),
                    ),
                  );
                },
              ),
      );

  Widget _buildProfileTab(DemoUser user) => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Your profile',
            style: Theme.of(context)
                .textTheme
                .headlineMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 18),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: _citrus,
                    foregroundColor: _forest,
                    child: Text(
                      user.name.characters.first.toUpperCase(),
                      style: const TextStyle(fontSize: 24),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    user.name,
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text('Demo profile · ${user.gender.replaceAll('_', ' ')}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            child: Column(
              children: [
                const ListTile(
                  leading: Icon(Icons.verified_user_outlined, color: _forest),
                  title: Text(
                    'Sandbox identity verification',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    'This demo check does not verify a real identity.',
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: Column(
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue: _sandboxGender,
                        decoration: const InputDecoration(
                          labelText: 'Simulated verified gender',
                        ),
                        items: const [
                          DropdownMenuItem(
                              value: 'woman', child: Text('Woman')),
                          DropdownMenuItem(value: 'man', child: Text('Man')),
                          DropdownMenuItem(
                            value: 'non_binary',
                            child: Text('Non-binary'),
                          ),
                        ],
                        onChanged: _busy
                            ? null
                            : (value) {
                                if (value != null) {
                                  setState(() => _sandboxGender = value);
                                }
                              },
                      ),
                      Row(
                        children: [
                          const Text('Simulated age'),
                          Expanded(
                            child: Slider(
                              value: _sandboxAge,
                              min: 18,
                              max: 100,
                              divisions: 82,
                              label: _sandboxAge.round().toString(),
                              onChanged: _busy
                                  ? null
                                  : (value) =>
                                      setState(() => _sandboxAge = value),
                            ),
                          ),
                          Text(_sandboxAge.round().toString()),
                        ],
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _busy ? null : _runSandboxVerification,
                      icon: const Icon(Icons.shield),
                      label: const Text('Run sandbox check'),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Identity checks and mutual matches use the Roomie API. '
                'The current backend does not provide persistent messaging.',
                style: TextStyle(color: Colors.black54, height: 1.45),
              ),
            ),
          ),
        ],
      );

  Future<void> _refreshMatches() async {
    final user = _user;
    if (user == null) return;
    try {
      final matches = await _api.getMatches(user.id);
      if (mounted && _user?.id == user.id) {
        setState(() => _matches = matches);
      }
    } on Exception catch (error) {
      _setError(error);
    }
  }
}

class _RoommateCardView extends StatelessWidget {
  const _RoommateCardView({required this.card});

  final RoommateCard card;

  @override
  Widget build(BuildContext context) {
    final profile = card.profile;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFFDCE7DC), Color(0xFFB8CFBD)],
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ROOMMATE PROFILE',
                  style: TextStyle(
                    color: _forest,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 26),
                CircleAvatar(
                  radius: 30,
                  backgroundColor: _citrus,
                  foregroundColor: _forest,
                  child: Text(
                    card.name.characters.first.toUpperCase(),
                    style: const TextStyle(fontSize: 24),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  card.age == null ? card.name : '${card.name}, ${card.age}',
                  style: Theme.of(context)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  card.commuteLocation.isEmpty
                      ? 'Location not shared'
                      : card.commuteLocation,
                ),
                const SizedBox(height: 12),
                Chip(
                  avatar: const Icon(Icons.auto_awesome, size: 16),
                  label: Text('${card.matchPercentage}% match'),
                  backgroundColor: _forest,
                  labelStyle: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                  side: BorderSide.none,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  card.occupation,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 5),
                Row(
                  children: [
                    Icon(
                      card.verified ? Icons.verified : Icons.info_outline,
                      color: card.verified ? _forest : Colors.orange,
                      size: 16,
                    ),
                    const SizedBox(width: 5),
                    Text(card.verified ? 'Identity verified' : 'Not verified'),
                    const Spacer(),
                    Text(
                      'Max rent ₹${card.maxRentBudget}',
                      style: const TextStyle(
                        color: _forest,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: [
                    if (profile['sleep_time'] != null)
                      _InfoChip('Sleeps ${profile['sleep_time']}'),
                    if (profile['work_mode'] != null)
                      _InfoChip('${profile['work_mode']}'.toUpperCase()),
                    if (profile['food'] != null)
                      _InfoChip(_prettyValue('${profile['food']}')),
                    if (profile['cleaning_frequency'] != null)
                      _InfoChip(
                        '${_prettyValue('${profile['cleaning_frequency']}')} cleaning',
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  childrenPadding: const EdgeInsets.only(bottom: 8),
                  title: const Text(
                    'Compatibility details',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  children: [
                    _ReportList(
                      title: 'Green flags',
                      items: card.greenFlags,
                      icon: Icons.check_circle_outline,
                    ),
                    _ReportList(
                      title: 'Worth discussing',
                      items: card.potentialFriction,
                      icon: Icons.chat_bubble_outline,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Chip(
        label: Text(label, style: const TextStyle(fontSize: 11)),
        backgroundColor: _paper,
        side: BorderSide.none,
        visualDensity: VisualDensity.compact,
      );
}

class _ReportList extends StatelessWidget {
  const _ReportList({
    required this.title,
    required this.items,
    required this.icon,
  });

  final String title;
  final List<String> items;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
            if (items.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 5),
                child: Text(
                  'No details yet',
                  style: TextStyle(color: Colors.black54),
                ),
              ),
            ...items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icon, size: 16, color: _forest),
                    const SizedBox(width: 7),
                    Expanded(child: Text(item)),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
}

class _SwipeButton extends StatelessWidget {
  const _SwipeButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => FilledButton.icon(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
        ),
        icon: Icon(icon),
        label: Text(label),
      );
}

class _OnboardingSheet extends StatefulWidget {
  const _OnboardingSheet({required this.name});

  final String name;

  @override
  State<_OnboardingSheet> createState() => _OnboardingSheetState();
}

class _OnboardingSheetState extends State<_OnboardingSheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 8, 20, bottomInset + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'How do you like to live, ${widget.name}?',
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          const Text(
            'Share your routine, cleanliness, guests, or food preferences.',
            style: TextStyle(color: Colors.black54),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            autofocus: true,
            minLines: 3,
            maxLines: 5,
            maxLength: 4000,
            decoration: InputDecoration(
              hintText: 'e.g. Early riser, work from home, vegetarian…',
              filled: true,
              fillColor: _paper,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => Navigator.pop(context, _controller.text.trim()),
              icon: const Icon(Icons.auto_awesome),
              label: const Text('Update my profile'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConnectionError extends StatelessWidget {
  const _ConnectionError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off, size: 48, color: _forest),
              const SizedBox(height: 16),
              Text(
                'Can’t reach the Roomie API',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              const Text(
                'Start the backend and set API_BASE_URL for your device or emulator.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 16),
              FilledButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ),
        ),
      );
}

class _EmptyUsers extends StatelessWidget {
  const _EmptyUsers({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.people_outline, size: 48, color: _forest),
              const SizedBox(height: 16),
              const Text(
                'No demo profiles yet',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              const Text(
                'Seed the backend demo data, then try again.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton(onPressed: onRetry, child: const Text('Refresh')),
            ],
          ),
        ),
      );
}

class _NoProfiles extends StatelessWidget {
  const _NoProfiles({required this.onRefresh});

  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Icon(Icons.auto_awesome, size: 38, color: _forest),
              const SizedBox(height: 12),
              const Text(
                'You’re all caught up',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              const Text(
                'There are no more eligible roommate profiles in your feed.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh),
                label: const Text('Refresh feed'),
              ),
            ],
          ),
        ),
      );
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => MaterialBanner(
        content: Text(message),
        leading: const Icon(Icons.error_outline, color: Colors.red),
        actions: [TextButton(onPressed: onRetry, child: const Text('Retry'))],
      );
}

String _prettyValue(String value) {
  if (value.isEmpty) return value;
  return value
      .split('_')
      .map(
        (word) => word.isEmpty
            ? word
            : '${word[0].toUpperCase()}${word.substring(1)}',
      )
      .join(' ');
}
