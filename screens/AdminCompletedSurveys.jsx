// screens/AdminCompletedSurveys.js
import React, { useCallback } from 'react';
import CompletedSurveysList from '../components/CompletedSurveyList';
import { api } from '../api/client';

export default function AdminCompletedSurveys({ navigation }) {
  // Admin-wide fetch: all users’ completed submissions
  const fetcher = useCallback(async () => {
    const { data } = await api.get('/admin/completed-surveys'); // admin scope
    return Array.isArray(data?.items) ? data.items : [];
  }, []);

  return (
    <CompletedSurveysList
      title="All Completed Surveys"
      searchPlaceholder="Search all surveys..."
      fetcher={fetcher}
      // ⬇️ Go to the Admin responses list (not Reports)
      onOpen={(item) =>

        navigation.navigate('ResponsesBySurveyAdmin', {
          surveyId: item.survey_id,
          surveyTitle: item.survey_title,
        })
      }
    />
  );
}
