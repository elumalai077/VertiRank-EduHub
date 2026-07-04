import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler, RadialLinearScale
} from 'chart.js';
import { Bar, Doughnut, Line, PolarArea } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, Filler, RadialLinearScale
);

// ─── Design Tokens (Light Mode) ──────────────────────────────────────────────
const T = {
  // Core palette — clean white base with light gray accents
  bg:        '#F8FAFC',
  surface:   '#FFFFFF',
  surfaceAlt:'#F1F5F9',
  border:    'rgba(0,0,0,0.08)',
  borderHover:'rgba(0,0,0,0.16)',

  // Accent — electric violet (kept vibrant but adjusted for light bg)
  accent:    '#7C5CFC',
  accentMid: '#6D4BFC',
  accentSoft:'rgba(124,92,252,0.10)',

  // Semantic
  green:  '#16A34A',
  amber:  '#D97706',
  red:    '#DC2626',
  blue:   '#2563EB',

  // Text
  text1: '#0F172A',
  text2: '#475569',
  text3: '#94A3B8',

  // Gradients
  gradAccent: 'linear-gradient(135deg, #7C5CFC 0%, #B45CFD 100%)',
  gradGreen:  'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
  gradAmber:  'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  gradRed:    'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
  gradBlue:   'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
};

const chartColors = [
  '#7C5CFC','#22C55E','#F59E0B','#3B82F6','#EF4444',
  '#B45CFD','#EC4899','#14B8A6','#F97316','#06B6D4'
];

// ─── Global CSS ────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; color: ${T.text1}; font-family: 'Inter', sans-serif; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(124,92,252,0.3); border-radius: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes shimmer {
    0%{background-position:-200% 0}
    100%{background-position:200% 0}
  }
  .qa-card { 
    transition: border-color .2s, box-shadow .2s; 
    background: ${T.surface};
  }
  .qa-card:hover { 
    border-color: ${T.borderHover} !important; 
    box-shadow: 0 4px 12px rgba(0,0,0,0.06) !important; 
  }
  .qa-chip { transition: all .15s; cursor: pointer; }
  .qa-chip:hover { border-color: ${T.accentMid} !important; color: ${T.accentMid} !important; background: ${T.accentSoft} !important; }
  .qa-chip-active { background: ${T.accentSoft} !important; border-color: ${T.accent} !important; color: ${T.accentMid} !important; }
  .qa-stat-card { animation: fadeUp .4s ease both; }
  .qa-badge { font-family: 'JetBrains Mono', monospace; }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const accuracy = (a) => {
  if (typeof a !== 'number') return { color: T.text3, label: '—' };
  if (a >= 70) return { color: T.green,  label: 'Easy',   gradient: T.gradGreen };
  if (a >= 40) return { color: T.amber,  label: 'Medium', gradient: T.gradAmber };
  return             { color: T.red,    label: 'Hard',   gradient: T.gradRed };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, gradient, delay = 0, icon }) {
  return (
    <div className="qa-stat-card qa-card" style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: '20px 22px',
      animationDelay: `${delay}ms`,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* accent glow strip */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:2,
        background: gradient || T.gradAccent, borderRadius:'16px 16px 0 0',
      }} />
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <span style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'1px', color:T.text3 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize:32, fontWeight:800, letterSpacing:'-1.5px', color:T.text1, fontFamily:"'JetBrains Mono',monospace" }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function SectionLabel({ children, dot }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:18 }}>
      {dot && <span style={{ width:6,height:6,borderRadius:'50%',background:T.accent,display:'inline-block' }} />}
      <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', color:T.text3 }}>
        {children}
      </span>
    </div>
  );
}

function ChartShell({ title, icon, full, children }) {
  return (
    <div className="qa-card" style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: '24px',
      gridColumn: full ? '1 / -1' : undefined,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <span style={{
          width:28, height:28, borderRadius:8, background:T.accentSoft,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
        }}>{icon}</span>
        <span style={{ fontSize:14, fontWeight:700, color:T.text1 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function OptionPill({ letter, text, isCorrect }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'10px 14px', borderRadius:10,
      background: isCorrect ? 'rgba(34,197,94,0.08)' : T.surfaceAlt,
      border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.3)' : T.border}`,
      fontSize:14, color: isCorrect ? T.green : T.text2,
      transition:'all .15s',
    }}>
      <span style={{
        width:26, height:26, borderRadius:7, flexShrink:0,
        background: isCorrect ? T.green : 'rgba(0,0,0,0.06)',
        color: isCorrect ? '#fff' : T.text3,
        fontWeight:700, fontSize:12,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>{letter}</span>
      <span style={{ flex:1 }}>{text}</span>
      {isCorrect && (
        <span style={{
          marginLeft:'auto', fontSize:11, fontWeight:700,
          background:'rgba(34,197,94,0.15)', color:T.green,
          padding:'2px 8px', borderRadius:20,
        }}>✓ Correct</span>
      )}
    </div>
  );
}

function AccuracyBar({ value }) {
  const a = accuracy(value);
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:11, color:T.text3 }}>Accuracy</span>
        <span style={{ fontSize:12, fontWeight:700, color:a.color, fontFamily:"'JetBrains Mono',monospace" }}>
          {typeof value === 'number' ? `${value}%` : '—'}
        </span>
      </div>
      <div style={{ height:4, borderRadius:4, background:'rgba(0,0,0,0.06)' }}>
        {typeof value === 'number' && (
          <div style={{
            height:'100%', borderRadius:4,
            width:`${Math.min(value,100)}%`,
            background: a.gradient || T.gradAccent,
            transition:'width 1s cubic-bezier(.4,0,.2,1)',
          }} />
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const QuestionAnalytics = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [questions, setQuestions] = useState([]);
  const [analysis, setAnalysis]   = useState([]);
  const [summary, setSummary]     = useState(null);
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [expandedQ, setExpandedQ]         = useState(null);

  const token = localStorage.getItem('token');

  const GET_QUESTIONS_URL = 'https://6mgkhsbr1a.execute-api.ap-south-1.amazonaws.com/default/question-get';
  const GET_ANALYSIS_URL  = 'https://53m2m6nrt0.execute-api.ap-south-1.amazonaws.com/default/questionanaysis-return';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true); 
        setError(null);
        
        const [qRes, aRes] = await Promise.all([
          fetch(GET_QUESTIONS_URL, {
            method:'POST',
            headers:{'Content-Type':'application/json','authorization':` ${token}`},
            body:JSON.stringify({ testId }),
          }),
          fetch(GET_ANALYSIS_URL, {
            method:'POST',
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
            body:JSON.stringify({ testId }),
          }),
        ]);
        
        if (!qRes.ok) throw new Error(`Questions API error: ${qRes.status}`);
        if (!aRes.ok) throw new Error(`Analysis API error: ${aRes.status}`);
        
        const qData = await qRes.json();
        const aData = await aRes.json();
        
        // Check if data exists
        if (!qData.data?.questions) throw new Error('Invalid questions data');
        if (!aData.questions || !aData.totalQuestions) throw new Error('Invalid analysis data');
        
        // Set questions
        setQuestions(qData.data.questions || []);
        
        // Transform analysis data - map each question to include questionNumber
        const analysisData = aData.questions.map((q, index) => ({
          questionNumber: q.questionNumber !== undefined ? q.questionNumber : index,
          accuracy: q.accuracy || 0,
          totalAttempts: q.totalAttempts || 0,
          correctCount: q.correctCount || 0,
          wrongCount: q.wrongCount || 0,
          optionBreakdown: q.optionBreakdown || {},
          correctAnswer: q.correctAnswer || '',
          notAttempted: q.notAttempted || 0,
        }));
        
        setAnalysis(analysisData);
        
        // Build summary from the analysis data
        const totalQuestions = aData.totalQuestions || 0;
        const totalAttempts = aData.questions.reduce((sum, q) => sum + (q.totalAttempts || 0), 0);
        const totalCorrect = aData.questions.reduce((sum, q) => sum + (q.correctCount || 0), 0);
        const totalWrong = aData.questions.reduce((sum, q) => sum + (q.wrongCount || 0), 0);
        const overallAccuracy = totalAttempts > 0 
          ? Math.round((totalCorrect / totalAttempts) * 100) 
          : 0;
        
        // Find unique students (using max attempts as proxy)
        const maxStudents = Math.max(...aData.questions.map(q => q.totalAttempts || 0), 0);
        
        // Find hardest and easiest questions
        const sortedQuestions = [...aData.questions].sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0));
        const hardestQuestions = sortedQuestions.slice(0, Math.min(5, sortedQuestions.length)).map((q, index) => ({
          questionNumber: q.questionNumber !== undefined ? q.questionNumber : index,
          accuracy: q.accuracy || 0,
          totalAttempts: q.totalAttempts || 0
        }));
        const easiestQuestions = [...sortedQuestions].reverse().slice(0, Math.min(5, sortedQuestions.length)).map((q, index) => ({
          questionNumber: q.questionNumber !== undefined ? q.questionNumber : index,
          accuracy: q.accuracy || 0,
          totalAttempts: q.totalAttempts || 0
        }));
        
        setSummary({
          totalStudents: maxStudents,
          totalQuestions: totalQuestions,
          overallAccuracy: overallAccuracy,
          totalCorrect: totalCorrect,
          totalWrong: totalWrong,
          hardestQuestions: hardestQuestions,
          easiestQuestions: easiestQuestions
        });
        
      } catch (err) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    if (testId) fetchData();
    else { 
      setError('No test ID provided'); 
      setLoading(false); 
    }
  }, [testId, token]);

  const getA = (qNum) => {
    const found = analysis.find(a => a.questionNumber === qNum);
    return found || {};
  };

  const topicAnalysis = useMemo(() => {
    const map = {};
    questions.forEach(q => {
      const t = q.topic || 'General';
      if (!map[t]) map[t] = { topic:t, questions:[], totalAccuracy:0, totalAttempts:0, correctCount:0, wrongCount:0 };
      const a = getA(q.questionNumber);
      map[t].questions.push(q);
      map[t].totalAccuracy  += a.accuracy     || 0;
      map[t].totalAttempts  += a.totalAttempts|| 0;
      map[t].correctCount   += a.correctCount || 0;
      map[t].wrongCount     += a.wrongCount   || 0;
    });
    return Object.values(map).map(t => ({
      ...t,
      avgAccuracy: t.questions.length ? t.totalAccuracy / t.questions.length : 0,
    }));
  }, [questions, analysis]);

  const uniqueTopics    = ['All', ...new Set(questions.map(q => q.topic || 'General'))];
  const filteredQs      = selectedTopic === 'All'
    ? questions
    : questions.filter(q => (q.topic || 'General') === selectedTopic);

  // ── Chart configs ──
  const lightChartDefaults = {
    color: T.text2,
    plugins: {
      legend: { 
        labels: { 
          color:T.text2, 
          usePointStyle:true, 
          pointStyle:'circle', 
          padding:16,
          font: { family: "'Inter', sans-serif" }
        }
      },
      tooltip: {
        backgroundColor: T.surface,
        borderColor: T.border,
        borderWidth:1,
        titleColor:T.text1,
        bodyColor:T.text2,
        titleFont: { family: "'Inter', sans-serif" },
        bodyFont: { family: "'Inter', sans-serif" },
      },
    },
  };

  const topicChartData = {
    labels: topicAnalysis.map(t => t.topic),
    datasets: [{
      label:'Avg Accuracy (%)',
      data: topicAnalysis.map(t => Math.round(t.avgAccuracy)),
      backgroundColor: topicAnalysis.map((_,i) => chartColors[i % chartColors.length] + 'CC'),
      borderColor:     topicAnalysis.map((_,i) => chartColors[i % chartColors.length]),
      borderWidth:1, borderRadius:8,
    }],
  };

  const distributionData = {
    labels:['Correct','Wrong','Unattempted'],
    datasets:[{
      data:[
        summary?.totalCorrect || 0,
        summary?.totalWrong   || 0,
        Math.max(0,(summary?.totalStudents||0)-(summary?.totalCorrect||0)-(summary?.totalWrong||0)),
      ],
      backgroundColor:['#16A34A','#DC2626','#CBD5E1'],
      borderWidth:0,
      hoverOffset:4,
    }],
  };

  const accuracyLineData = {
    labels: questions.map((_,i) => `Q${i+1}`),
    datasets:[{
      label:'Accuracy (%)',
      data: questions.map(q => Math.round(getA(q.questionNumber).accuracy||0)),
      borderColor: T.accent,
      backgroundColor:'rgba(124,92,252,0.08)',
      fill:true, tension:0.4,
      pointBackgroundColor: questions.map(q => accuracy(getA(q.questionNumber).accuracy).color),
      pointRadius:5, pointHoverRadius:7, borderWidth:2,
    }],
  };

  const difficultyData = {
    labels:['Easy (≥70%)','Medium (40–69%)','Hard (<40%)'],
    datasets:[{
      data:[
        questions.filter(q=>(getA(q.questionNumber).accuracy||0)>=70).length,
        questions.filter(q=>{const a=getA(q.questionNumber).accuracy||0;return a>=40&&a<70}).length,
        questions.filter(q=>(getA(q.questionNumber).accuracy||0)<40).length,
      ],
      backgroundColor:['#16A34A','#D97706','#DC2626'],
      borderWidth:0,
    }],
  };

  const barOpts = {
    ...lightChartDefaults,
    responsive:true,
    scales:{
      y:{ 
        beginAtZero:true, 
        grid:{color:'rgba(0,0,0,0.05)'}, 
        ticks:{color:T.text3, font: { family: "'Inter', sans-serif" }} 
      },
      x:{ 
        grid:{display:false}, 
        ticks:{color:T.text3, font: { family: "'Inter', sans-serif" }} 
      },
    },
  };

  const doughnutOpts = {
    ...lightChartDefaults,
    cutout:'65%',
    responsive:true,
  };

  const lineOpts = {
    ...lightChartDefaults,
    responsive:true,
    plugins:{
      ...lightChartDefaults.plugins,
      legend:{display:false},
      tooltip:{
        ...lightChartDefaults.plugins.tooltip,
        callbacks:{ label:(ctx)=>`${ctx.parsed.y}%` },
      },
    },
    scales:{
      y:{ 
        beginAtZero:true, 
        max:100, 
        grid:{color:'rgba(0,0,0,0.05)'}, 
        ticks:{color:T.text3, callback:v=>`${v}%`, font: { family: "'Inter', sans-serif" }}
      },
      x:{ 
        grid:{display:false}, 
        ticks:{color:T.text3, font: { family: "'Inter', sans-serif" }} 
      },
    },
  };

  const polarOpts = {
    ...lightChartDefaults,
    responsive:true,
    scales:{ 
      r:{ 
        grid:{color:'rgba(0,0,0,0.06)'}, 
        ticks:{display:false} 
      }
    },
  };

  // ── Loading ──
  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:T.bg, gap:20 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ position:'relative', width:56, height:56 }}>
        <div style={{ width:56, height:56, borderRadius:'50%', border:`2px solid ${T.border}`, borderTopColor:T.accent, animation:'spin .8s linear infinite' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📊</div>
      </div>
      <p style={{ color:T.text2, fontSize:14, fontWeight:500 }}>Loading analytics…</p>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:T.bg, gap:16 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width:56, height:56, borderRadius:16, background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>⚠️</div>
      <p style={{ color:T.red, fontWeight:600 }}>{error}</p>
      <button onClick={()=>window.location.reload()} style={{ padding:'10px 24px', background:T.gradAccent, color:'#fff', border:'none', borderRadius:10, fontWeight:600, fontSize:14, cursor:'pointer' }}>
        Retry
      </button>
    </div>
  );

  const summaryItems = summary ? [
    { label:'Total Students',   value:summary.totalStudents,      gradient:T.gradBlue,   icon:'👥' },
    { label:'Questions',        value:summary.totalQuestions,     gradient:T.gradAccent, icon:'📝' },
    { label:'Overall Accuracy', value:`${summary.overallAccuracy}%`, gradient: accuracy(summary.overallAccuracy).gradient || T.gradAmber, icon:'🎯' },
    { label:'Correct',          value:summary.totalCorrect,       gradient:T.gradGreen,  icon:'✅' },
    { label:'Wrong',            value:summary.totalWrong,         gradient:T.gradRed,    icon:'❌' },
  ] : [];

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:"'Inter', sans-serif", color:T.text1 }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Topbar ── */}
      <header style={{
        position:'sticky', top:0, zIndex:200,
        background:'rgba(248,250,252,0.85)',
        backdropFilter:'blur(16px)',
        borderBottom:`1px solid ${T.border}`,
        padding:'0 32px', height:60,
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button 
            onClick={() => navigate(-1)}
            style={{
              width:32, height:32, borderRadius:9,
              background:'transparent', border:`1px solid ${T.border}`,
              display:'flex', alignItems:'center', justifyContent:'center', 
              fontSize:18, cursor:'pointer',
              transition:'all 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.background = T.accentSoft}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
          >
            ←
          </button>
          <div style={{
            width:32, height:32, borderRadius:9,
            background:T.gradAccent,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:15,
          }}>📊</div>
          <span style={{ fontWeight:800, fontSize:16, letterSpacing:'-0.4px', color:T.text1 }}>Question Analytics</span>
          <span style={{
            fontSize:11, fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase',
            background:T.accentSoft, color:T.accentMid,
            padding:'3px 10px', borderRadius:20, border:`1px solid rgba(124,92,252,0.25)`,
          }}>BETA</span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:12, color:T.text3 }}>Test</span>
          <span className="qa-badge" style={{
            fontFamily:"'JetBrains Mono',monospace",
            fontSize:12, fontWeight:600, color:T.accentMid,
            background:T.accentSoft, padding:'4px 12px', borderRadius:8,
            border:`1px solid rgba(124,92,252,0.25)`,
          }}>#{testId}</span>
        </div>
      </header>

      <main style={{ maxWidth:1280, margin:'0 auto', padding:'36px 24px 80px' }}>

        {/* ── Summary KPI Cards ── */}
        {summary && (
          <section style={{ marginBottom:40 }}>
            <SectionLabel dot>Overview</SectionLabel>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14 }}>
              {summaryItems.map((s,i) => (
                <StatCard key={i} delay={i*60} {...s} />
              ))}
            </div>
          </section>
        )}

        {/* ── Charts ── */}
        <section style={{ marginBottom:40 }}>
          <SectionLabel dot>Performance Insights</SectionLabel>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

            {topicAnalysis.length > 0 && (
              <ChartShell title="Topic-wise Accuracy" icon="📊" full>
                <Bar data={topicChartData} options={barOpts} height={70} />
              </ChartShell>
            )}

            <ChartShell title="Answer Distribution" icon="🎯">
              <div style={{ maxWidth:300, margin:'0 auto' }}>
                <Doughnut data={distributionData} options={doughnutOpts} />
              </div>
            </ChartShell>

            <ChartShell title="Difficulty Spread" icon="🏔️">
              <div style={{ maxWidth:300, margin:'0 auto' }}>
                <PolarArea data={difficultyData} options={polarOpts} />
              </div>
            </ChartShell>

            <ChartShell title="Accuracy Trend — Question by Question" icon="📈" full>
              <Line data={accuracyLineData} options={lineOpts} height={70} />
            </ChartShell>
          </div>
        </section>

        {/* ── Topic Filter ── */}
        <section>
          <SectionLabel dot>Question Breakdown</SectionLabel>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:24 }}>
            {uniqueTopics.map(topic => {
              const count = topic === 'All' ? questions.length : questions.filter(q=>(q.topic||'General')===topic).length;
              const isActive = selectedTopic === topic;
              return (
                <button
                  key={topic}
                  className={`qa-chip${isActive?' qa-chip-active':''}`}
                  onClick={() => setSelectedTopic(topic)}
                  style={{
                    padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:500,
                    border:`1px solid ${T.border}`,
                    background: isActive ? T.accentSoft : 'transparent',
                    color: isActive ? T.accentMid : T.text2,
                    borderColor: isActive ? T.accent : T.border,
                    cursor:'pointer',
                    display:'flex', alignItems:'center', gap:6,
                  }}
                >
                  {topic}
                  <span style={{
                    fontSize:11, fontWeight:700,
                    background: isActive ? T.accent : 'rgba(0,0,0,0.05)',
                    color: isActive ? '#fff' : T.text3,
                    borderRadius:20, padding:'1px 7px',
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* ── Question Cards ── */}
          {filteredQs.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:200, gap:12, background:T.surface, borderRadius:16, border:`1px solid ${T.border}` }}>
              <span style={{ fontSize:36 }}>📭</span>
              <p style={{ color:T.text3 }}>No questions for this topic.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {filteredQs.map((q) => {
                const a    = getA(q.questionNumber);
                const acc  = accuracy(a.accuracy);
                const open = expandedQ === q.questionNumber;

                return (
                  <div key={q.questionNumber} className="qa-card" style={{
                    background:T.surface,
                    border:`1px solid ${T.border}`,
                    borderRadius:16,
                    overflow:'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    {/* ── Header row ── */}
                    <div
                      onClick={() => setExpandedQ(open ? null : q.questionNumber)}
                      style={{
                        display:'flex', alignItems:'center', gap:14,
                        padding:'16px 22px',
                        cursor:'pointer',
                        background: open ? T.surfaceAlt : 'transparent',
                        borderBottom: open ? `1px solid ${T.border}` : 'none',
                        transition:'background .2s',
                      }}
                    >
                      {/* Q number badge */}
                      <div style={{
                        width:40, height:40, borderRadius:12, flexShrink:0,
                        background:T.gradAccent,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:13, fontWeight:800, color:'#fff',
                        fontFamily:"'JetBrains Mono',monospace",
                      }}>
                        {q.questionNumber}
                      </div>

                      {/* Question preview */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{
                          fontSize:14, fontWeight:500, color:T.text1,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                        }}>
                          {q.question}
                        </p>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
                          <span style={{
                            fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.6px',
                            background:T.accentSoft, color:T.accentMid,
                            padding:'2px 8px', borderRadius:20,
                          }}>{q.questionType || 'MCQ'}</span>
                          {q.topic && (
                            <span style={{ fontSize:11, color:T.text3 }}>🏷 {q.topic}</span>
                          )}
                        </div>
                      </div>

                      {/* Right side stats */}
                      <div style={{ display:'flex', alignItems:'center', gap:20, flexShrink:0 }}>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:10, color:T.text3, marginBottom:2, textTransform:'uppercase', letterSpacing:'.5px' }}>Accuracy</div>
                          <div style={{ fontSize:18, fontWeight:800, color:acc.color, fontFamily:"'JetBrains Mono',monospace" }}>
                            {typeof a.accuracy === 'number' ? `${a.accuracy}%` : '—'}
                          </div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:10, color:T.text3, marginBottom:2, textTransform:'uppercase', letterSpacing:'.5px' }}>Difficulty</div>
                          <span style={{
                            fontSize:11, fontWeight:700,
                            background: `${acc.color}18`,
                            color:acc.color,
                            padding:'3px 10px', borderRadius:20,
                          }}>{acc.label}</span>
                        </div>
                        <div style={{
                          width:24, height:24, borderRadius:8,
                          background:'rgba(0,0,0,0.04)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:T.text3, fontSize:11,
                          transform: open ? 'rotate(180deg)' : 'none',
                          transition:'transform .2s',
                        }}>▼</div>
                      </div>
                    </div>

                    {/* ── Expanded body ── */}
                    {open && (
                      <div style={{ padding:'22px 22px 0' }}>
                        {/* Assertion / Reason */}
                        {q.assertion && (
                          <div style={{
                            background:T.surfaceAlt, border:`1px solid ${T.border}`,
                            borderRadius:10, padding:'14px 16px', marginBottom:16,
                            fontSize:14, color:T.text2, lineHeight:1.7,
                          }}>
                            <div><span style={{ color:T.accentMid, fontWeight:600 }}>Assertion:</span> {q.assertion}</div>
                            {q.reason && <div style={{ marginTop:8 }}><span style={{ color:T.accentMid, fontWeight:600 }}>Reason:</span> {q.reason}</div>}
                          </div>
                        )}

                        <p style={{ fontSize:15, lineHeight:1.7, color:T.text1, marginBottom:16, fontWeight:500 }}>
                          {q.question}
                        </p>

                        {/* Options */}
                        {q.options?.length > 0 && (
                          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
                            {q.options.map((opt,idx) => {
                              const letter = String.fromCharCode(65+idx);
                              return (
                                <OptionPill key={idx} letter={letter} text={opt} isCorrect={q.correctAnswer===letter} />
                              );
                            })}
                          </div>
                        )}

                        {/* Pairs */}
                        {q.pairs?.length > 0 && (
                          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
                            {q.pairs.map((pair,idx) => (
                              <div key={idx} style={{ fontSize:14, color:T.text2, padding:'8px 12px', background:T.surfaceAlt, borderRadius:8 }}>
                                {pair}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Explanation */}
                        {q.explanation && (
                          <div style={{
                            display:'flex', gap:10, alignItems:'flex-start',
                            background:'rgba(217,119,6,0.06)', border:'1px solid rgba(217,119,6,0.2)',
                            borderRadius:10, padding:'12px 16px', marginBottom:18,
                            fontSize:13, color:T.amber, lineHeight:1.6,
                          }}>
                            <span style={{ flexShrink:0 }}>💡</span>
                            <span>{q.explanation}</span>
                          </div>
                        )}

                        {/* Accuracy bar */}
                        <AccuracyBar value={a.accuracy} />

                        {/* Stats row */}
                        <div style={{
                          display:'grid', gridTemplateColumns:'repeat(5,1fr)',
                          gap:1, background:T.border,
                          borderTop:`1px solid ${T.border}`,
                          margin:'18px -22px 0', borderRadius:'0 0 16px 16px',
                          overflow:'hidden',
                        }}>
                          {[
                            { label:'Correct Answer', value:q.correctAnswer||'—', color:T.green },
                            { label:'Attempts',       value:a.totalAttempts??0 },
                            { label:'✓ Correct',      value:a.correctCount??0,  color:T.green },
                            { label:'✗ Wrong',        value:a.wrongCount??0,    color:T.red },
                            { label:'Weightage',      value:`+${q.weightage||1}`, color:T.accentMid },
                          ].map((s,i) => (
                            <div key={i} style={{ padding:'14px 16px', background:T.surfaceAlt }}>
                              <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.7px', color:T.text3, marginBottom:5 }}>{s.label}</div>
                              <div className="qa-badge" style={{
                                fontSize:18, fontWeight:800,
                                color:s.color||T.text1,
                                fontFamily:"'JetBrains Mono',monospace",
                              }}>{s.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Option breakdown */}
                        {a.optionBreakdown && Object.keys(a.optionBreakdown).length > 0 && (
                          <div style={{
                            display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
                            padding:'12px 0 18px',
                            borderTop:`1px solid ${T.border}`,
                            marginTop:1,
                          }}>
                            <span style={{ fontSize:11, color:T.text3, textTransform:'uppercase', letterSpacing:'.5px', fontWeight:600 }}>Chosen:</span>
                            {Object.entries(a.optionBreakdown).map(([k,v]) => (
                              <span key={k} style={{
                                fontSize:12, fontWeight:600, padding:'4px 10px', borderRadius:20,
                                background:T.accentSoft, color:T.accentMid,
                                border:`1px solid rgba(124,92,252,0.25)`,
                                fontFamily:"'JetBrains Mono',monospace",
                              }}>{k}: {v}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Insights Panel ── */}
        {summary?.hardestQuestions && summary?.easiestQuestions && (
          <section style={{ marginTop:48 }}>
            <SectionLabel dot>Insights</SectionLabel>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {/* Hardest */}
              <div className="qa-card" style={{ 
                background:T.surface, 
                border:`1px solid ${T.border}`, 
                borderRadius:16, 
                padding:'22px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:18 }}>
                  <span style={{ width:28,height:28,borderRadius:8,background:'rgba(220,38,38,0.10)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>🔥</span>
                  <span style={{ fontSize:14, fontWeight:700, color:T.text1 }}>Hardest Questions</span>
                </div>
                {summary.hardestQuestions.slice(0,5).map((q,i,arr) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'11px 0',
                    borderBottom: i<arr.length-1 ? `1px solid ${T.border}` : 'none',
                  }}>
                    <span className="qa-badge" style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700, color:T.accentMid, minWidth:40 }}>Q{q.questionNumber+1}</span>
                    <div style={{ flex:1, marginLeft:12 }}>
                      <div style={{ height:4, borderRadius:4, background:'rgba(0,0,0,0.06)' }}>
                        <div style={{ height:'100%', borderRadius:4, width:`${q.accuracy}%`, background:T.gradRed, transition:'width 1s' }} />
                      </div>
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color:T.red, marginLeft:12, fontFamily:"'JetBrains Mono',monospace" }}>{q.accuracy}%</span>
                    <span style={{ fontSize:11, color:T.text3, marginLeft:10 }}>{q.totalAttempts} tries</span>
                  </div>
                ))}
              </div>

              {/* Easiest */}
              <div className="qa-card" style={{ 
                background:T.surface, 
                border:`1px solid ${T.border}`, 
                borderRadius:16, 
                padding:'22px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:18 }}>
                  <span style={{ width:28,height:28,borderRadius:8,background:'rgba(22,163,74,0.10)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>⭐</span>
                  <span style={{ fontSize:14, fontWeight:700, color:T.text1 }}>Easiest Questions</span>
                </div>
                {summary.easiestQuestions.slice(0,5).map((q,i,arr) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'11px 0',
                    borderBottom: i<arr.length-1 ? `1px solid ${T.border}` : 'none',
                  }}>
                    <span className="qa-badge" style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700, color:T.accentMid, minWidth:40 }}>Q{q.questionNumber+1}</span>
                    <div style={{ flex:1, marginLeft:12 }}>
                      <div style={{ height:4, borderRadius:4, background:'rgba(0,0,0,0.06)' }}>
                        <div style={{ height:'100%', borderRadius:4, width:`${q.accuracy}%`, background:T.gradGreen, transition:'width 1s' }} />
                      </div>
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color:T.green, marginLeft:12, fontFamily:"'JetBrains Mono',monospace" }}>{q.accuracy}%</span>
                    <span style={{ fontSize:11, color:T.text3, marginLeft:10 }}>{q.totalAttempts} tries</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default QuestionAnalytics;