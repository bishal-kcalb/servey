// screens/CompletedSurveys.js
import React from 'react';
import CompletedSurveysList from '../components/CompletedSurveyList.jsx';

export default function CompletedSurveys({ navigation }) {
  return (
    <CompletedSurveysList
      title="Completed Surveys"
      searchPlaceholder="Search by survey title..."
      // default fetcher uses GET /responses/me
      onOpen={(item) =>
        navigation.navigate('SurveyResponsesList', {
          surveyId: item.survey_id,
          surveyTitle: item.survey_title,
        })
      }
    />
  );
}
