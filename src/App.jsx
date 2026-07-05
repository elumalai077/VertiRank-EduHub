import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginPage from "./pages/auth/LoginPage";
import HomePage from "./pages/dashboard/HomePage";

import BatchLayout from "./pages/batch/BatchLayout";
import BatchDetails from "./pages/batch/BatchDetails";
import RankList from "./pages/batch/RankList.jsx";
import CreateTest from "./pages/batch/CreateTest";
import Students from "./pages/batch/Students";
import StudentPerformance from "./pages/batch/StudentPerformance";
import TestList from "./pages/tests/TestList";
import Questioncreate from "./pages/tests/Questioncreate";
import TestEdit from "./pages/tests/EditTestDetails";
import TestDetailsPage from "./pages/tests/TestDetailsPage";
import QuestionView from "./pages/tests/QuestionView";
import AnalyticsPage from "./pages/tests/AnalyticsPage";
import QuestionAnalytics from "./pages/tests/QuestionAnalytics";
import SyllabusCreate from "./pages/batch/SyllabusCreate";
import AnnouncementPage from "./pages/batch/Announcement";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route path="/" element={<LoginPage />} />

        {/* Home */}
        <Route path="/home" element={<HomePage />} />

        <Route path="/Questioncreate/:testId" element={<Questioncreate/>} />
        <Route path="/test/edit/:testId" element={<TestEdit/>} />
        <Route path="/test/details/:testId" element={<TestDetailsPage/>} />
        <Route path="/test/question/:testId" element={<QuestionView/>} />
        <Route path="/test/analytics/:testId" element={<AnalyticsPage/>} />
        <Route path="/test/question-details/:testId" element={<QuestionAnalytics/>} />

        {/* Batch Routes */}
        <Route path="/batch/:batchId" element={<BatchLayout />}>
          <Route index element={<BatchDetails />} />
          <Route path="rank-list" element={<RankList />} />
          <Route path="student-performance/:studentId" element={<StudentPerformance />} />
          <Route path="create-test" element={<CreateTest />} />
          <Route path="tests" element={<TestList />} />
          <Route path="students" element={<Students />} />
          <Route path="syllabus" element={<SyllabusCreate />} />
          <Route path="announcement" element={<AnnouncementPage />} />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
