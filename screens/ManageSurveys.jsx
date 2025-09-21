// screens/ManageSurveys.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Modal, TextInput,
  ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView, Keyboard, SafeAreaView
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { api } from '../api/client.js';

// Components
import ViewSurveyModal from '../components/ViewSurveyModal';
import EditHeadingModal from '../components/EditHeadingModal';
import EditQuestionModal from '../components/EditQuestionModal';
import ScreenContainer from '../components/ScreenContainer.jsx';

/** Normalize /survey/:id/full structure so ids are consistent */
const normalizeFullSurvey = (data) => ({
  ...data,
  id: Number(data?.id) || data?.id,
  headings: (data?.headings || []).map((h) => ({
    ...h,
    id: Number(h?.id) || h?.id,
    questions: (h?.questions || []).map((q) => ({
      ...q,
      id: Number(q?.id) || q?.id,
      options: (q?.options || []).map((o) => ({
        ...o,
        id: Number(o?.id) || o?.id,
      })),
      sub_questions: (q?.sub_questions || []).map((s) => ({
        ...s,
        id: Number(s?.id) || s?.id,
      })),
    })),
  })),
});

const isServerId = (v) => v !== null && v !== undefined && String(v).trim() !== '';

export default function ManageSurveys() {
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

  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // View modal (read-only)
  const [viewModal, setViewModal] = useState({ visible: false, full: null, loading: false });

  // Builder modal (create/edit whole survey)
  const [modalVisible, setModalVisible] = useState(false);
  const [currentSurvey, setCurrentSurvey] = useState(null); // { id } when editing
  const [resumeBuilderAfterChild, setResumeBuilderAfterChild] = useState(false);

  // Survey fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Headings
  const [headings, setHeadings] = useState([]);
  const [newHeadingTitle, setNewHeadingTitle] = useState('');
  const [activeHeadingIndex, setActiveHeadingIndex] = useState(0);

  // Question builder
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState('input');
  const [isComposite, setIsComposite] = useState(false);
  const [isRequired, setIsRequired] = useState(true);
  const [checkboxOptions, setCheckboxOptions] = useState([]); // [{ text, is_other }]
  const [optionText, setOptionText] = useState('');
  const [optionIsOther, setOptionIsOther] = useState(false);
  const [subQuestions, setSubQuestions] = useState([]); // [{ label, type }]
  const [subLabel, setSubLabel] = useState('');
  const [subType, setSubType] = useState('input');

  // Inline edit modals
  const [headingEditModal, setHeadingEditModal] = useState({ visible: false, id: null, title: '' });
  const [questionEditModal, setQuestionEditModal] = useState({
    visible: false, id: null, text: '', type: 'input', is_required: true, is_composite: false,
    options: [], sub_questions: []
  });

  // ===== NEW: Assignment modal state =====
  const [assignModal, setAssignModal] = useState({
    visible: false,
    surveyId: null,
    loading: false,
    surveyors: [],
    selectedId: null,
    assignees: [],
  });
  const [assignSearch, setAssignSearch] = useState('');

  const closeBuilder = () => {
    Keyboard.dismiss();
    setModalVisible(false);
  };

  /* --------------------------- Load list of surveys -------------------------- */
  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/survey');
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.surveys) ? data.surveys : []);
        setSurveys(rows.map(s => ({ ...s, id: String(s.id) })));
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to load surveys');
      } finally {
        setLoading(false);
      }
    };
    fetchSurveys();
  }, []);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      const { data } = await api.get('/survey');
      const rows = Array.isArray(data) ? data : (Array.isArray(data?.surveys) ? data.surveys : []);
      setSurveys(rows.map(s => ({ ...s, id: String(s.id) })));
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  // NEW: filtered data (search by title)
  const filteredSurveys = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return surveys;
    return surveys.filter(s => (s.title || '').toLowerCase().includes(q));
  }, [surveys, search]);

  /* ------------------------------ Builder helpers --------------------------- */
  const resetQuestionBuilder = () => {
    setQuestionText('');
    setQuestionType('input');
    setIsComposite(false);
    setIsRequired(true);
    setCheckboxOptions([]);
    setOptionText('');
    setOptionIsOther(false);
    setSubQuestions([]);
    setSubLabel('');
    setSubType('input');
  };

  const openNewSurvey = () => {
    setTitle(''); setDescription(''); setHeadings([]); setActiveHeadingIndex(0);
    setCurrentSurvey(null); resetQuestionBuilder(); setModalVisible(true);
  };

  const refreshCurrentSurvey = async () => {
    if (!currentSurvey?.id) return;
    const { data } = await api.get(`/survey/${currentSurvey.id}/full`);
    const full = normalizeFullSurvey(data);
    setTitle(full.title);
    setDescription(full.description || '');
    setHeadings(full.headings || []);
    setActiveHeadingIndex(0);
  };

  const openEditSurvey = async (item) => {
    try {
      const { data } = await api.get(`/survey/${item.id}/full`);
      const full = normalizeFullSurvey(data);
      setTitle(full.title);
      setDescription(full.description || '');
      setHeadings(full.headings || []);
      setActiveHeadingIndex(0);
      resetQuestionBuilder();
      setCurrentSurvey({ id: full.id });
      setModalVisible(true);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load survey for editing');
    }
  };

  const openViewSurvey = async (item) => {
    try {
      setViewModal({ visible: true, full: null, loading: true });
      const { data } = await api.get(`/survey/${item.id}/full`);
      setViewModal({ visible: true, full: normalizeFullSurvey(data), loading: false });
    } catch (e) {
      console.error(e);
      setViewModal({ visible: false, full: null, loading: false });
      Alert.alert('Error', 'Failed to load survey details');
    }
  };

  /* --------------------------- Assignment helpers --------------------------- */
  const openAssignModal = async (survey) => {
    try {
      setAssignModal(m => ({ ...m, visible: true, surveyId: survey.id, loading: true, selectedId: null, assignees: [], surveyors: [] }));
      const [{ data: sList }, { data: aList }] = await Promise.all([
        api.get('/survey/surveyors'),
        api.get(`/survey/${survey.id}/assignees`),
      ]);
      setAssignModal(m => ({
        ...m,
        loading: false,
        surveyors: Array.isArray(sList?.surveyors) ? sList.surveyors : [],
        assignees: Array.isArray(aList?.assignees) ? aList.assignees : [],
      }));
    } catch (e) {
      console.error(e);
      setAssignModal(m => ({ ...m, visible: false, loading: false }));
      Alert.alert('Error', e?.response?.data?.error || 'Failed to load surveyors');
    }
  };

  const closeAssignModal = () => {
    setAssignModal({ visible: false, surveyId: null, loading: false, surveyors: [], selectedId: null, assignees: [] });
    setAssignSearch('');
  };

  const handleAssign = async () => {
    if (!assignModal.selectedId) {
      return Alert.alert('Select surveyor', 'Please choose a surveyor to assign.');
    }
    try {
      setAssignModal(m => ({ ...m, loading: true }));
      await api.post(`/survey/${assignModal.surveyId}/assign`, {
        surveyor_id: Number(assignModal.selectedId),
      });
      const { data } = await api.get(`/survey/${assignModal.surveyId}/assignees`);
      setAssignModal(m => ({ ...m, loading: false, assignees: data.assignees || [] }));
      Alert.alert('Assigned', 'Survey assigned successfully.');
    } catch (e) {
      console.error(e);
      setAssignModal(m => ({ ...m, loading: false }));
      Alert.alert('Error', e?.response?.data?.error || 'Failed to assign survey');
    }
  };

  const handleUnassign = async (surveyorId) => {
    Alert.alert('Unassign', 'Remove this surveyor from the survey?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setAssignModal(m => ({ ...m, loading: true }));
            await api.delete(`/survey/${assignModal.surveyId}/assignees/${surveyorId}`);
            const { data } = await api.get(`/survey/${assignModal.surveyId}/assignees`);
            setAssignModal(m => ({ ...m, loading: false, assignees: data.assignees || [] }));
          } catch (e) {
            console.error(e);
            setAssignModal(m => ({ ...m, loading: false }));
            Alert.alert('Error', e?.response?.data?.error || 'Failed to unassign');
          }
        }
      }
    ]);
  };

  /* --------------------------------- Builder -------------------------------- */
  const addHeading = () => {
    const t = newHeadingTitle.trim();
    if (!t) return;
    setHeadings(prev => [...prev, { id: Date.now().toString(), title: t, questions: [] }]);
    setNewHeadingTitle('');
    setActiveHeadingIndex(headings.length);
  };

  const deleteHeadingLocal = (idx) => {
    setHeadings(prev => prev.filter((_, i) => i !== idx));
    setActiveHeadingIndex(0);
  };

  const addCheckboxOption = () => {
    const t = optionText.trim();
    if (!t) return;
    setCheckboxOptions(prev => [...prev, { text: t, is_other: optionIsOther }]);
    setOptionText(''); setOptionIsOther(false);
  };
  const removeCheckboxOption = (idx) => {
    setCheckboxOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const addSubQ = () => {
    const l = subLabel.trim();
    if (!l) return;
    setSubQuestions(prev => [...prev, { label: l, type: subType }]);
    setSubLabel(''); setSubType('input');
  };
  const removeSubQ = (idx) => {
    setSubQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddQuestion = () => {
    if (!questionText.trim()) return Alert.alert('Question text is required');
    if (!headings.length) return Alert.alert('Add a heading first');

    const newQuestion = {
      id: Date.now().toString(),
      text: questionText.trim(),
      type: questionType,
      is_required: isRequired,
      is_composite: isComposite,
      options: questionType === 'checkbox'
        ? checkboxOptions.map(o => ({ option_text: o.text, is_other: !!o.is_other }))
        : [],
      sub_questions: isComposite ? subQuestions.map(s => ({ label: s.label, type: s.type })) : [],
    };

    setHeadings(prev => {
      const copy = [...prev];
      copy[activeHeadingIndex].questions.push(newQuestion);
      return copy;
    });
    resetQuestionBuilder();
  };

  const handleDeleteQuestionLocal = (qid) => {
    setHeadings(prev => {
      const copy = [...prev];
      copy[activeHeadingIndex].questions = copy[activeHeadingIndex].questions.filter(q => q.id !== qid);
      return copy;
    });
  };

  const handleSaveSurvey = async () => {
    if (!title.trim()) return Alert.alert('Survey title is required');
    if (!headings.length) return Alert.alert('Add at least one heading');
    if (!headings.some(h => h.questions.length > 0)) return Alert.alert('Add at least one question');

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      headings: headings.map(h => ({
        title: h.title,
        questions: (h.questions || []).map(q => ({
          type: q.type,
          text: q.text,
          is_required: !!q.is_required,
          is_composite: !!q.is_composite,
          options: q.type === 'checkbox' ? (q.options || []) : [],
          sub_questions: q.is_composite ? (q.sub_questions || []) : []
        }))
      }))
    };

    try {
      const isEdit = !!currentSurvey?.id;
      if (isEdit) await api.put(`/survey/${currentSurvey.id}/full`, payload);
      else await api.post('/survey/full', payload);

      const { data } = await api.get('/survey');
      const rows = Array.isArray(data) ? data : (Array.isArray(data?.surveys) ? data.surveys : []);
      setSurveys(rows.map(s => ({ ...s, id: String(s.id) })));

      closeBuilder();
      Alert.alert('Success', isEdit ? 'Survey updated' : 'Survey created');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save survey');
    }
  };

  /* --------------------------------- Render --------------------------------- */
  const renderSurvey = ({ item }) => (
    <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border, shadowColor: '#000' }]}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={() => openEditSurvey(item)}>
        <Text style={[styles.surveyTitle, { color: COLORS.text }]} numberOfLines={1}>{item.title}</Text>
        {item.description ? <Text style={{ color: COLORS.subtle, marginTop: 4 }} numberOfLines={2}>{item.description}</Text> : null}
        <Text style={{ marginTop: 6, fontSize: 12, color: COLORS.subtle }}>Tap to edit</Text>
      </TouchableOpacity>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => openViewSurvey(item)} style={styles.iconBtn}>
          <Feather name="eye" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openEditSurvey(item)} style={styles.iconBtn}>
          <Feather name="edit-3" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        {/* NEW: Assign button */}
        <TouchableOpacity onPress={() => openAssignModal(item)} style={styles.iconBtn}>
          <Feather name="user-plus" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleDeleteSurvey(item.id)} style={styles.iconBtn}>
          <Feather name="trash-2" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleDeleteSurvey = (id) => {
    Alert.alert('Delete Survey', 'This will permanently remove the survey. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/survey/${id}`);
            const { data } = await api.get('/survey');
            const rows = Array.isArray(data) ? data : (Array.isArray(data?.surveys) ? data.surveys : []);
            setSurveys(rows.map(s => ({ ...s, id: String(s.id) })));
            Alert.alert('Deleted', 'Survey removed');
          } catch (e) {
            console.error(e);
            Alert.alert('Error', e?.response?.data?.error || 'Failed to delete survey');
          }
        }
      }
    ]);
  };

  return (
    <ScreenContainer>
      <View style={[styles.container, { backgroundColor: COLORS.bg }]}>

        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: COLORS.text }]}>Manage Surveys</Text>
            <Text style={styles.subtitle}>Create, edit and review all surveys</Text>
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}
            onPress={openNewSurvey}
            activeOpacity={0.9}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>New Survey</Text>
          </TouchableOpacity>
        </View>

        {/* Search box */}
        <View style={[styles.searchWrap, { borderColor: COLORS.border, backgroundColor: COLORS.card }]}>
          <Feather name="search" size={18} color={COLORS.subtle} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title…"
            placeholderTextColor="#9ca3af"
            style={[styles.searchInput, { color: COLORS.text }]}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={18} color={COLORS.subtle} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredSurveys}
            keyExtractor={(item) => item.id}
            renderItem={renderSurvey}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <Text style={{ color: COLORS.subtle, textAlign: 'center', marginTop: 24 }}>
                {search ? 'No results for your search.' : 'No surveys yet. Create one!'}
              </Text>
            }
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 12 }}
          />
        )}

        {/* ===== Builder Modal (Create/Edit) ===== */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          statusBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={closeBuilder}
        >
          <View style={styles.modalOverlay} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap}>
            <SafeAreaView style={[styles.sheet, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <View style={[styles.grabberRow]}><View style={[styles.grabber]} /></View>
              <View style={[styles.sheetHeader,{paddingHorizontal:12}]}>
                <Text style={[styles.sheetTitle, { color: COLORS.text }]}>{currentSurvey ? 'Edit Survey' : 'New Survey'}</Text>
                <TouchableOpacity onPress={closeBuilder} hitSlop={8}>
                  <Feather name="x" size={22} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 8 }}>
                {/* Basic Info */}
                <View style={[styles.sectionCard, { borderColor: COLORS.border }]}>
                  <Text style={styles.sectionHeader}>Basic info</Text>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
                    placeholder="Survey Title"
                    placeholderTextColor="#9ca3af"
                    value={title}
                    onChangeText={setTitle}
                  />
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
                    placeholder="Description (optional)"
                    placeholderTextColor="#9ca3af"
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>

                {/* Headings */}
                <View style={[styles.sectionCard, { borderColor: COLORS.border }]}>
                  <Text style={styles.sectionHeader}>Headings</Text>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, { flex: 1, borderColor: COLORS.border, color: COLORS.text }]}
                      placeholder="Heading title"
                      placeholderTextColor="#9ca3af"
                      value={newHeadingTitle}
                      onChangeText={setNewHeadingTitle}
                    />
                    <TouchableOpacity onPress={addHeading} style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {headings.map((h, idx) => (
                        <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity
                            onPress={() => setActiveHeadingIndex(idx)}
                            style={[
                              styles.chip,
                              { backgroundColor: COLORS.chipBg, borderColor: COLORS.border },
                              activeHeadingIndex === idx && { backgroundColor: COLORS.primary }
                            ]}
                          >
                            <Text style={{ color: activeHeadingIndex === idx ? '#fff' : COLORS.text, fontWeight: '700' }}>
                              {h.title}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => openHeadingEdit(h)} style={{ marginLeft: 4 }}>
                            <MaterialIcons name="edit" size={18} color={COLORS.primary} />
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => deleteHeadingLocal(idx)} style={{ marginLeft: 2 }}>
                            <MaterialIcons name="close" size={18} color="#f44336" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Question Builder */}
                <View style={[styles.sectionCard, { borderColor: COLORS.border }]}>
                  <Text style={styles.sectionHeader}>Add question to heading</Text>
                  <Text style={styles.label}>Question text</Text>
                  <TextInput
                    style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
                    placeholder="Enter your question..."
                    placeholderTextColor="#9ca3af"
                    value={questionText}
                    onChangeText={setQuestionText}
                  />

                  <Text style={styles.label}>Type</Text>
                  <View style={[styles.typeRow, { marginBottom: 8 }]}>
                    {['input', 'yes_no', 'checkbox', 'audio', 'video'].map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeButton,
                          { borderColor: COLORS.border, backgroundColor: '#f3f4f6' },
                          questionType === type && { backgroundColor: COLORS.primary }
                        ]}
                        onPress={() => setQuestionType(type)}
                      >
                        <Text style={{ color: questionType === type ? '#fff' : COLORS.text, fontWeight: '700' }}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                    <TouchableOpacity onPress={() => setIsRequired(v => !v)} style={styles.rowToggle}>
                      <MaterialIcons name={isRequired ? 'check-box' : 'check-box-outline-blank'} size={22} color={COLORS.text} />
                      <Text style={{ color: COLORS.text }}>Required</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsComposite(v => !v)} style={styles.rowToggle}>
                      <MaterialIcons name={isComposite ? 'check-box' : 'check-box-outline-blank'} size={22} color={COLORS.text} />
                      <Text style={{ color: COLORS.text }}>Composite</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Checkbox options */}
                  {questionType === 'checkbox' && (
                    <>
                      <Text style={styles.label}>Checkbox options</Text>
                      <View style={{ gap: 8, marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TextInput
                            style={[styles.input, { flex: 1, borderColor: COLORS.border, color: COLORS.text }]}
                            placeholder="Option text"
                            placeholderTextColor="#9ca3af"
                            value={optionText}
                            onChangeText={setOptionText}
                          />
                          <TouchableOpacity onPress={addCheckboxOption} style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}>
                            <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <TouchableOpacity onPress={() => setOptionIsOther(p => !p)}>
                            <MaterialIcons name={optionIsOther ? 'check-box' : 'check-box-outline-blank'} size={22} color={COLORS.text} />
                          </TouchableOpacity>
                          <Text style={{ color: COLORS.text }}>Mark this option as “Other”</Text>
                        </View>
                        {checkboxOptions.map((opt, idx) => (
                          <View key={idx} style={styles.inlineRow}>
                            <Text style={{ flex: 1, color: COLORS.text }}>
                              {opt.text}{opt.is_other ? ' (Other)' : ''}
                            </Text>
                            <TouchableOpacity onPress={() => removeCheckboxOption(idx)}>
                              <MaterialIcons name="delete" size={18} color="#f44336" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Composite sub-questions */}
                  {isComposite && (
                    <>
                      <Text style={styles.label}>Sub-questions</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TextInput
                          style={[styles.input, { flex: 1, borderColor: COLORS.border, color: COLORS.text }]}
                          placeholder="Sub-question label"
                          placeholderTextColor="#9ca3af"
                          value={subLabel}
                          onChangeText={setSubLabel}
                        />
                      </View>
                      <View style={[styles.typeRow, { marginTop: 6 }]}>
                        {['input', 'yes_no', 'checkbox'].map(t => (
                          <TouchableOpacity
                            key={t}
                            style={[
                              styles.typeButton,
                              { borderColor: COLORS.border, backgroundColor: '#f3f4f6' },
                              subType === t && { backgroundColor: COLORS.primary }
                            ]}
                            onPress={() => setSubType(t)}
                          >
                            <Text style={{ color: subType === t ? '#fff' : COLORS.text, fontWeight: '700' }}>{t}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity onPress={addSubQ} style={[styles.smallBtn, { backgroundColor: COLORS.primary, marginTop: 6 }]}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Add sub-question</Text>
                      </TouchableOpacity>
                      {subQuestions.map((sq, idx) => (
                        <View key={idx} style={styles.inlineRow}>
                          <Text style={{ flex: 1, color: COLORS.text }}>{sq.label} ({sq.type})</Text>
                          <TouchableOpacity onPress={() => removeSubQ(idx)}>
                            <MaterialIcons name="delete" size={20} color="#f44336" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  )}

                  <TouchableOpacity
                    onPress={handleAddQuestion}
                    style={[styles.fullBtn, { backgroundColor: COLORS.primary, marginTop: 8 }]}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.fullBtnText}>Add Question</Text>
                  </TouchableOpacity>
                </View>

                {/* Current questions */}
                <View style={[styles.sectionCard, { borderColor: COLORS.border }]}>
                  <Text style={styles.sectionHeader}>Questions in heading</Text>
                  {(headings[activeHeadingIndex]?.questions || []).map((q) => (
                    <View key={q.id} style={[styles.questionRow, { borderColor: COLORS.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: COLORS.text, fontWeight: '600' }}>{q.text}</Text>
                        <Text style={{ fontSize: 12, color: COLORS.subtle, marginTop: 2 }}>
                          {q.type} {q.is_composite ? '• composite' : ''} {q.is_required ? '• required' : ''}
                        </Text>
                        {q.type === 'checkbox' && q.options?.length ? (
                          <Text style={{ fontSize: 12, color: COLORS.subtle, marginTop: 2 }}>
                            Options: {q.options.map(o => o.option_text + (o.is_other ? ' (Other)' : '')).join(', ')}
                          </Text>
                        ) : null}
                        {q.is_composite && q.sub_questions?.length ? (
                          <Text style={{ fontSize: 12, color: COLORS.subtle, marginTop: 2 }}>
                            Sub: {q.sub_questions.map(s => `${s.label} (${s.type})`).join(', ')}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={() => openQuestionEdit(q)}>
                          <Feather name="edit-3" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteQuestionLocal(q.id)}>
                          <Feather name="trash-2" size={20} color="#f44336" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Sticky footer actions */}
              <View style={[styles.footerBar, { borderTopColor: COLORS.border, backgroundColor: COLORS.card }]}>
                <TouchableOpacity onPress={closeBuilder} style={styles.cancelBtn}>
                  <Text style={{ color: COLORS.text, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveSurvey} style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {currentSurvey ? 'Update (Batch)' : 'Save (Batch)'}
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* ===== Inline Modals ===== */}
        <EditHeadingModal
          visible={headingEditModal.visible}
          title={headingEditModal.title}
          onChangeTitle={(t) => setHeadingEditModal(m => ({ ...m, title: t }))}
          onCancel={() => {
            setHeadingEditModal({ visible: false, id: null, title: '' });
            if (Platform.OS === 'ios' && resumeBuilderAfterChild) {
              setResumeBuilderAfterChild(false);
              requestAnimationFrame(() => setModalVisible(true));
            }
          }}
          onSave={async () => {
            await saveHeadingEdit();
            if (Platform.OS === 'ios' && resumeBuilderAfterChild) {
              setResumeBuilderAfterChild(false);
              requestAnimationFrame(() => setModalVisible(true));
            }
          }}
          themeColor={COLORS.primary}
        />

        <EditQuestionModal
          visible={questionEditModal.visible}
          value={questionEditModal}
          setValue={setQuestionEditModal}
          onCancel={() => {
            setQuestionEditModal({
              visible: false, id: null, text: '', type: 'input', is_required: true, is_composite: false,
              options: [], sub_questions: []
            });
            if (Platform.OS === 'ios' && resumeBuilderAfterChild) {
              setResumeBuilderAfterChild(false);
              requestAnimationFrame(() => setModalVisible(true));
            }
          }}
          onSave={async () => {
            await saveQuestionEdit();
            if (Platform.OS === 'ios' && resumeBuilderAfterChild) {
              setResumeBuilderAfterChild(false);
              requestAnimationFrame(() => setModalVisible(true));
            }
          }}
          themeColor={COLORS.primary}
        />

        <ViewSurveyModal
          visible={viewModal.visible}
          full={viewModal.full}
          loading={viewModal.loading}
          onClose={() => setViewModal({ visible: false, full: null, loading: false })}
        />

        {/* ===== Assign Survey Modal ===== */}
        <Modal visible={assignModal.visible} transparent animationType="slide" onRequestClose={closeAssignModal}>
          <View style={[styles.modalOverlay,{paddingHorizontal:200}]} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap}>
            <SafeAreaView style={[styles.sheet, { backgroundColor: COLORS.card, borderColor: COLORS.border, margin:8}]}>
              <View style={[styles.sheetHeader,{padding:12}]}>
                <Text style={[styles.sheetTitle, { color: COLORS.text }]}>Assign Survey</Text>
                <TouchableOpacity onPress={closeAssignModal} hitSlop={8}>
                  <Feather name="x" size={22} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Current assignees */}
              <View style={[styles.sectionCard, { borderColor: COLORS.border, marginHorizontal:12 }]}>
                <Text style={styles.sectionHeader}>Current assignees</Text>
                {assignModal.assignees?.length ? (
                  <View style={{ gap: 8 }}>
                    {assignModal.assignees.map(a => (
                      <View key={a.id} style={[styles.inlineRow, { borderBottomColor: COLORS.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: COLORS.text }}>{a.surveyor_name}</Text>
                          <Text style={{ color: COLORS.subtle, fontSize: 12 }}>{a.surveyor_email}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleUnassign(a.surveyor_id)}>
                          <Feather name="user-minus" size={20} color="#f44336" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: COLORS.subtle }}>No one assigned yet.</Text>
                )}
              </View>

              {/* Search surveyor */}
              <View style={[styles.searchWrap, { borderColor: COLORS.border, backgroundColor: COLORS.card, marginHorizontal:12 }]}>
                <Feather name="search" size={18} color={COLORS.subtle} />
                <TextInput
                  value={assignSearch}
                  onChangeText={setAssignSearch}
                  placeholder="Search surveyor by name/email…"
                  placeholderTextColor="#9ca3af"
                  style={[styles.searchInput, { color: COLORS.text }]}
                />
                {!!assignSearch && (
                  <TouchableOpacity onPress={() => setAssignSearch('')}>
                    <Feather name="x" size={18} color={COLORS.subtle} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Surveyor list */}
              <ScrollView style={{ maxHeight: 320, marginHorizontal:12, marginBlock:38 }}>
                <View style={[styles.sectionCard, { borderColor: COLORS.border }]}>
                  <Text style={styles.sectionHeader}>Choose surveyor</Text>
                  {assignModal.loading ? (
                    <ActivityIndicator />
                  ) : (
                    (assignModal.surveyors || [])
                      .filter(s => {
                        const q = assignSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
                      })
                      .map(s => {
                        const selected = Number(assignModal.selectedId) === Number(s.id);
                        return (
                          <TouchableOpacity
                            key={s.id}
                            onPress={() => setAssignModal(m => ({ ...m, selectedId: s.id }))}
                            style={[styles.inlineRow, { borderBottomColor: COLORS.border }]}
                            activeOpacity={0.8}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: COLORS.text, fontWeight: '600' }}>{s.name}</Text>
                              <Text style={{ color: COLORS.subtle, fontSize: 12 }}>{s.email}</Text>
                            </View>
                            <Feather name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? COLORS.primary : COLORS.subtle} />
                          </TouchableOpacity>
                        );
                      })
                  )}
                </View>
              </ScrollView>

              {/* Footer actions */}
              <View style={[styles.footerBar, { borderTopColor: COLORS.border, backgroundColor: COLORS.card }]}>
                <TouchableOpacity onPress={closeAssignModal} style={styles.cancelBtn}>
                  <Text style={{ color: COLORS.text, fontWeight: '700' }}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAssign} disabled={!assignModal.selectedId || assignModal.loading}
                  style={[styles.saveBtn, { backgroundColor: !assignModal.selectedId? COLORS.primary : COLORS.primary }]}>
                  {assignModal.loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '800' }}>Assign</Text>}
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>
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

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 0, fontSize: 14 },

  card: {
    padding: 16,
    borderRadius: RADIUS,
    borderWidth: 1,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  surveyTitle: { fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: {
    height: 36, width: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6'
  },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, borderTopWidth: 1, maxHeight: '90%', marginTop: 'auto' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontWeight: '800' },

  label: { fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },

  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },

  rowToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },

  fullBtn: { marginTop: 8, borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  fullBtnText: { color: '#fff', fontWeight: '800' },

  questionRow: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },

  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#f3f4f6' },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },

  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 12, marginBottom: 6 },

  grabberRow: { alignItems: 'center', paddingTop: 6 },
  grabber: { width: 42, height: 5, borderRadius: 999, backgroundColor: '#e5e7eb' },

  sectionCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12, backgroundColor: '#fff' },
  sectionHeader: { fontSize: 13, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },

  footerBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1,
    flexDirection: 'row', justifyContent: 'flex-end', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },

  smallBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
});
