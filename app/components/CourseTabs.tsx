import React from 'react';
import { Link } from '@remix-run/react';

interface Section {
  assessmentCriteria: 'QUIZ' | 'ASSESSMENT';
  // Add other properties as needed
}

interface CourseTabsProps {
  sections: Section[];
  courseId: string;
  showDisabledTabs?: boolean; // Option to show the tab but disabled
  activeTab?: string; // New prop for the active tab
}

const CourseTabs: React.FC<CourseTabsProps> = ({ sections, courseId, showDisabledTabs = false, activeTab }) => {
  // Check if any section has assessmentCriteria set to 'ASSESSMENT'
  const hasAssessment = sections.length > 0 && sections.some(section => section.assessmentCriteria === 'ASSESSMENT');

  // Check if any section has assessmentCriteria set to 'QUIZ'
  const hasQuiz = sections.length > 0 && sections.some(section => section.assessmentCriteria === 'QUIZ');

  // Function to get the className for the card-body
  const getCardBodyClass = (tabName: string) => {
    return `card-body${activeTab === tabName ? ' active' : ''}`;
  };

  return (
    <ul className="resources-list">
      <li>
        <div className="card h-100 card-lift">
          <Link to={`/portal/my-courses/${courseId}`}>
            <div className={getCardBodyClass('Resources')}>
              <div className="align-items-center mb-3">
                <div>
                  <h3 className="mb-1 fw-bold">Resources</h3>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </li>

      <li>
        <div className="card h-100 card-lift">
          <Link to={`/portal/my-courses/${courseId}/chat`}>
            <div className={getCardBodyClass('Playground')}>
              <div className="align-items-center mb-3">
                <div>
                  <h3 className="mb-1 fw-bold">Playground</h3>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </li>

      {(hasAssessment || showDisabledTabs) && (
        <li>
          <div className="card h-100 card-lift">
            {hasAssessment ? (
              <Link to={`/portal/my-courses/${courseId}/final-assessment`}>
                <div className={getCardBodyClass('Final Assessment')}>
                  <div className="align-items-center mb-3">
                    <div>
                      <h3 className="mb-1 fw-bold">Final Assessment</h3>
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              <div className={`${getCardBodyClass('Final Assessment')} disabled`}>
                <div className="align-items-center mb-3">
                  <div>
                    <h3 className="mb-1 fw-bold">Final Assessment</h3>
                  </div>
                </div>
              </div>
            )}
          </div>
        </li>
      )}

      {(hasQuiz || showDisabledTabs) && (
        <li>
          <div className="card h-100 card-lift">
            {hasQuiz ? (
              <Link to={`/portal/my-courses/${courseId}/questions`}>
                <div className={getCardBodyClass('Question Paper')}>
                  <div className="align-items-center mb-3">
                    <div>
                      <h3 className="mb-1 fw-bold">Question Paper</h3>
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              <div className={`${getCardBodyClass('Question Paper')} disabled`}>
                <div className="align-items-center mb-3">
                  <div>
                    <h3 className="mb-1 fw-bold">Question Paper</h3>
                  </div>
                </div>
              </div>
            )}
          </div>
        </li>
      )}
    </ul>
  );
};

export default CourseTabs;
