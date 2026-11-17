import { Section } from '~/models/section';

export async function fillQuestionsForCourses(courseIds) {
  if (!Array.isArray(courseIds)) {
    courseIds = [courseIds];
  }

  for (const courseId of courseIds) {
    const sections = await Section.find({ course: courseId }).populate({
      path: 'topics.documents',
    });

    for (const section of sections) {
      await fillQuestionsForSection(section);
    }
  }
}

export async function fillQuestionsForSection(section) {
  const topics = section.topics || [];
  let sectionModified = false;

  for (const topic of topics) {
    if (!topic.questions || topic.questions.length < 2) {
      const missingQuestions = 2 - (topic.questions ? topic.questions.length : 0);

      let docs = [];
      if (topic.documents && topic.documents.length > 0) {
        topic.documents.forEach(doc => {
          docs.push(doc.file);
        });
      }

      if (docs.length === 0) {
        console.warn(`No documents found for topic: ${topic.topic}. Skipping.`);
        continue;
      }

      const data = {
        question: `AI Assistant, please create a quiz with TOTAL: ${missingQuestions} questions based on the provided document. Set the difficulty level to 9`,
        overrideConfig: {
          returnSourceDocuments: false,
          pineconeMetadataFilter: {
            filename: {
              $in: docs,
            },
          },
        },
      };

      const questionsFromAPI = await queryAiQuestionPaper(data, 'https://flowise.klaspad.com/api/v1/prediction/30e06072-ed0f-47b4-8840-bd5a072b2f4b');

      if (Array.isArray(questionsFromAPI) && questionsFromAPI.length > 0) {
        for (const question of questionsFromAPI) {
          const newQuestion = {
            question: question.question,
            topicName: topic.topic,
            apiAnswer: question.answer || '',
          };
          topic.questions.push(newQuestion);
        }
        sectionModified = true;
      } else {
        console.error(`No questions returned from API for topic: ${topic.topic}`);
      }
    }
  }

  if (sectionModified) {
    await section.save();
  }

  return sectionModified;
}

// Helper functions for parsing the API response
async function cleanAndParseJson(textPart) {
  try {
    // Remove the ```json and ``` markers
    let cleanedText = textPart.replace(/```json|```/g, '').trim();

    // Clean up unwanted escape characters and + signs
    cleanedText = cleanedText.replace(/\\n|\+/g, '').trim();

    // Parse the cleaned text as JSON
    let parsedJson;
    try {
      parsedJson = JSON.parse(cleanedText);
    } catch (err) {
      console.error('Error parsing JSON:', err);
      return null;
    }

    return parsedJson;
  } catch (error) {
    console.error('Error cleaning and parsing:', error);
    return null;
  }
}

async function extractQuizQuestions(data) {
  try {
    // Extract the text part
    const textPart = data.text || null;

    if (!textPart) {
      console.error('No text part found in the data:', data);
      return null;
    }

    // Parse the text part as JSON
    const parsedText = JSON.parse(textPart);
    const questions = parsedText.questions || [];

    // Return the questions
    return questions;
  } catch (error) {
    console.error('Error extracting quiz questions:', error);
    return null;
  }
}

async function queryAiQuestionPaper(data, url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  const result = await response.text();
  const parsedJson = await cleanAndParseJson(result);
  const questions = await extractQuizQuestions(parsedJson);

  return questions;
}
