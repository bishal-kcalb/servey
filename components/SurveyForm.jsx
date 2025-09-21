import react,{useState} from 'react'
import {View, Text, TextInput, ScrollView, Button}  from 'react-native'
// import CheckBox from '@react-native-community/checkbox';
import CheckBox from 'expo-checkbox'




const SurveyForm = ()=>{
    const surveyQuestions = [
  {
    id: "1",
    type: "yes_no",
    text: "Are you satisfied with our service?"
  },
  {
    id: "2",
    type: "input",
    text: "What could we improve?"
  },
  {
    id: "3",
    type: "checkbox",
    text: "Which features do you use?",
    options: ["Search", "Notifications", "Profile", "Settings"]
  }
];

const [answers, setAnswers] = useState({})

    return(
        <ScrollView>
            {surveyQuestions.map(question=>(
              <View key={question.id}>
                  <Text>{question.text}</Text>
                  {question.type === 'yes_no' &&(
                    <View>
                        <Button title='Yes'/>
                        <Button title='No'/>

                    </View>
                  )}

                {question.type === 'input' && (
                  <View>
                    <TextInput
                    placeholder='enter answer'  
                    />

                  </View>
                )}


                    {question.type === 'checkbox' && question.options.map(option => (
            <View key={option} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CheckBox
                value={answers[question.id]?.includes(option) || false}
                onValueChange={() => handleCheckbox(question.id, option)}
              />
              <Text>{option}</Text>
            </View>
          ))}

              </View>
            ))}
        </ScrollView>
    )
}



export default SurveyForm;