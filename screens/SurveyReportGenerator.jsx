// screens/SurveyReportGenerator.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../theme';
import ScreenContainer from '../components/ScreenContainer';

export default function SurveyReportGenerator() {
  const theme = useTheme();

  const COLORS = {
    primary: '#10b981',
    bg: theme?.colors?.background || '#f7f7fb',
    text: theme?.colors?.text || '#111827',
    subtle: '#6b7280',
    card: '#ffffff',
    border: '#e5e7eb',
    chipBg: '#eef2ff',
  };

  // Sample data (could be props or route params in real usage)
  const [survey] = useState({
    title: 'Customer Satisfaction Survey',
    meta: {
      respondent: 'John Doe',
      date: new Date().toLocaleString(),
      location: 'Downtown Branch',
    },
    answers: [
      { question: 'What is your name?', answer: 'John Doe' },
      { question: 'Are you satisfied with our service?', answer: 'Yes' },
      { question: 'What features do you like?', answer: 'Clean UI, Fast service' },
      { question: 'Would you recommend us to others?', answer: 'Absolutely' },
    ],
  });

  const [includeMeta, setIncludeMeta] = useState(true);
  const [autoShare, setAutoShare] = useState(true);
  const [generating, setGenerating] = useState(false);

  const htmlContent = useMemo(() => {
    // inline CSS for a clean, printable layout
    const rows = survey.answers
      .map(
        (a, i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;width:38%;vertical-align:top;font-weight:600;">${i + 1}. ${a.question}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top;">${a.answer}</td>
      </tr>`
      )
      .join('');

    const meta = includeMeta
      ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 6px 0;">
          <span style="background:#eef2ff;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;color:#111827;">
            Respondent: ${survey.meta.respondent}
          </span>
          <span style="background:#e8fff4;border:1px solid #d1fae5;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;color:#065f46;">
            Date: ${survey.meta.date}
          </span>
          <span style="background:#fef3c7;border:1px solid #fde68a;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;color:#92400e;">
            Location: ${survey.meta.location}
          </span>
        </div>
      `
      : '';

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'; color:#111827; margin:0; padding:24px; background:#ffffff;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
            <div style="font-size:22px;font-weight:800;">${survey.title}</div>
            <div style="font-size:12px;color:#6b7280;">Generated: ${new Date().toLocaleString()}</div>
          </div>

          ${meta}

          <table style="width:100%; border-collapse:collapse; margin-top:8px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #111827;font-size:13px;">Question</th>
                <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #111827;font-size:13px;">Answer</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div style="margin-top:18px;font-size:12px;color:#6b7280;">
            © ${new Date().getFullYear()} Survey Report
          </div>
        </body>
      </html>
    `;
  }, [survey, includeMeta]);

  const generatePDF = async () => {
    try {
      setGenerating(true);

      const { uri } = await RNHTMLtoPDF.convert({
        html: htmlContent,
        fileName: `survey-report-${Date.now()}`,
        base64: false,
      });

      Alert.alert('PDF Generated', 'Report created successfully.');

      if (autoShare && Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri);
      }
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const Row = ({ label, value }) => (
    <View style={[styles.row, { borderBottomColor: COLORS.border }]}>
      <Text style={[styles.rowLabel, { color: COLORS.subtle }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: COLORS.text }]}>{value}</Text>
    </View>
  );

  return (
    <ScreenContainer>
      <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: COLORS.text }]}>Survey Report</Text>
            <Text style={styles.subtitle}>Preview and export a PDF summary</Text>
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}
            onPress={generatePDF}
            activeOpacity={0.9}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="download" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Generate PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Options */}
        <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border, shadowColor: '#000' }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Options</Text>

          <View style={styles.optionRow}>
            <Text style={{ color: COLORS.text, fontWeight: '700' }}>Include metadata</Text>
            <Switch value={includeMeta} onValueChange={setIncludeMeta} />
          </View>

          <View style={styles.optionRow}>
            <Text style={{ color: COLORS.text, fontWeight: '700' }}>Share after generating</Text>
            <Switch value={autoShare} onValueChange={setAutoShare} />
          </View>
        </View>

        {/* Preview (sample report) */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border, shadowColor: '#000' }]}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>{survey.title}</Text>

            {includeMeta && (
              <View style={styles.pillsRow}>
                <View style={[styles.pill, { backgroundColor: COLORS.chipBg, borderColor: COLORS.border }]}>
                  <Text style={[styles.pillText, { color: COLORS.text }]}>
                    Respondent: {survey.meta.respondent}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: '#e8fff4', borderColor: '#d1fae5' }]}>
                  <Text style={[styles.pillText, { color: '#065f46' }]}>Date: {survey.meta.date}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                  <Text style={[styles.pillText, { color: '#92400e' }]}>Location: {survey.meta.location}</Text>
                </View>
              </View>
            )}

            <View style={{ marginTop: 6 }}>
              {survey.answers.map((a, i) => (
                <View key={i} style={[styles.qaRow, { borderColor: COLORS.border }]}>
                  <Text style={[styles.qText, { color: COLORS.text }]}>{i + 1}. {a.question}</Text>
                  <Text style={[styles.aText, { color: COLORS.subtle }]}>{a.answer}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Quick summary card */}
          <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border, shadowColor: '#000' }]}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Quick Summary</Text>
            <Row label="Total Questions" value={String(survey.answers.length)} />
            <Row label="Satisfied?" value={survey.answers[1]?.answer || '—'} />
            <Row label="Highlights" value={survey.answers[2]?.answer || '—'} />
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const RADIUS = 16;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },

  headerRow: {
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, color: '#8b8b8b', marginTop: 2 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },

  card: {
    padding: 16,
    borderRadius: RADIUS,
    borderWidth: 1,
    marginBottom: 14,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },

  // options
  optionRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // preview chips
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  pill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontWeight: '800' },

  // preview Q/A
  qaRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  qText: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  aText: { fontSize: 14 },

  // quick summary rows
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 12, marginBottom: 4 },
  rowValue: { fontSize: 15, fontWeight: '600' },
});
