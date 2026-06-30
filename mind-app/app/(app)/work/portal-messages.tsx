import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../../constants/theme';
import { useTheme, useColors } from '../../../contexts/ThemeContext';
import { type PortalMessage, fetchPortalMessages } from '../../../services/work';
import { Screen } from '../../../components/Screen';
import { SkeletonList } from '../../../components/Skeleton';
import { AnimatedEmptyState } from '../../../components/AnimatedEmptyState';

export default function PortalMessagesScreen() {
  const { isDark } = useTheme();
  const colors = useColors();
  const router = useRouter();

  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async (p: number, append = false, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!append) setLoading(true);
    else setLoadingMore(true);
    setError(false);
    try {
      const data = await fetchPortalMessages(p);
      setMessages(prev => append ? [...prev, ...data.messages] : data.messages);
      setNextPage(data.nextPage);
      setPage(p);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    load(1, false, true);
  };

  const toggleExpanded = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadMore = () => {
    if (!nextPage || loadingMore) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    load(page + 1, true);
  };

  return (
    <Screen scroll backgroundColor={colors.background}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Wiadomości</Text>
        <TouchableOpacity onPress={() => load(1)} hitSlop={8}>
          <MaterialCommunityIcons name="refresh" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nie udało się pobrać wiadomości</Text>
          <TouchableOpacity onPress={() => load(1)} style={[styles.retryBtn, { backgroundColor: colors.accent }]}>
            <Text style={styles.retryText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      ) : messages.length === 0 ? (
        <AnimatedEmptyState icon="email-open-outline" title="Brak wiadomości" subtitle="Twoja skrzynka portalu jest pusta" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        >
          {messages.map((msg) => {
            const isOpen = expanded.has(msg.id);
            return (
              <TouchableOpacity
                key={msg.id}
                activeOpacity={0.7}
                onPress={() => toggleExpanded(msg.id)}
                style={[
                  styles.msgCard,
                  { backgroundColor: colors.surface },
                  msg.unread && { borderLeftColor: colors.accent, borderLeftWidth: 3 },
                ]}
              >
                <View style={styles.msgHeader}>
                  <View style={styles.msgHeaderLeft}>
                    <MaterialCommunityIcons
                      name={msg.unread ? 'email' : 'email-open-outline'}
                      size={18}
                      color={msg.unread ? colors.accent : colors.textSecondary}
                    />
                    <Text
                      style={[styles.msgSubject, { color: colors.text }, msg.unread && styles.msgUnread]}
                      numberOfLines={isOpen ? undefined : 1}
                    >
                      {msg.subject || '(brak tematu)'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>

                <View style={styles.msgMeta}>
                  <Text style={[styles.msgSender, { color: colors.textSecondary }]}>{msg.sender}</Text>
                  <Text style={[styles.msgTime, { color: colors.textSecondary }]}>{msg.timestamp}</Text>
                </View>

                {isOpen && msg.body ? (
                  <View style={[styles.msgBody, { borderTopColor: colors.border }]}>
                    <Text style={[styles.msgBodyText, { color: colors.text }]}>{msg.body}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}

          {nextPage && (
            <TouchableOpacity
              onPress={loadMore}
              style={[styles.loadMoreBtn, { backgroundColor: colors.surface }]}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={colors.accent} />
                  <Text style={[styles.loadMoreText, { color: colors.accent }]}>Załaduj więcej</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '700', marginLeft: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 16, gap: 8 },

  msgCard: { borderRadius: 14, padding: 14, gap: 6 },
  msgHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  msgHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  msgSubject: { fontSize: 14, flex: 1 },
  msgUnread: { fontWeight: '700' },
  msgMeta: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 26 },
  msgSender: { fontSize: 12 },
  msgTime: { fontSize: 12 },
  msgBody: { borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  msgBodyText: { fontSize: 13, lineHeight: 20 },

  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 14, borderRadius: 14,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600' },
});
