require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const Tesseract = require('tesseract.js');
const axios   = require('axios');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

/* ---------- 预设评分规则 ---------- */
const rules = [
  {keyword:/主题突出|点题/i,  pts:25, advice:'开头结尾需再次点题'},
  {keyword:/内容丰富|细节/i, pts:25, advice:'加入更多细节描写'},
  {keyword:/结构清晰|段落/i, pts:20, advice:'注意段落衔接'},
  {keyword:/语言生动|修辞/i, pts:20, advice:'多用比喻、拟人'},
  {keyword:/书写工整|卷面/i, pts:10, advice:'保持卷面整洁'}
];

/* ---------- 评星函数 ---------- */
async function scoreText(text){
  let total = 0, lines = [];
  rules.forEach(r=>{
    const hit = r.keyword.test(text);
    const got = hit ? r.pts : 0;
    total += got;
    lines.push(`${r.keyword.toString().slice(1,-1)}：${got}/${r.pts} —— ${r.advice}`);
  });
  let star = total >= 90 ? 5 : total >= 75 ? 4 : 3;
  // 再让 Kimi 润色建议
  const prompt = `你是一名语文老师，请用 60 字以内给这段作文提出改进建议：\n${text}`;
  const {data}=await axios.post('https://api.moonshot.cn/v1/chat/completions',{
    model:'moonshot-v1-8k',
    messages:[{role:'user',content:prompt}],
    max_tokens:80,
    temperature:0.3
  },{headers:{Authorization:`Bearer ${process.env.KIMI_API_KEY}`}});

  return {
    star,
    total,
    details: lines.join('\n'),
    suggestion: data.choices[0].message.content.trim()
  };
}

/* ---------- 上传接口 ---------- */
app.post('/score', upload.single('image'), async (req,res)=>{
  try{
    // 1. OCR
    const {data:{text}}=await Tesseract.recognize(req.file.path,'chi_sim');
    // 2. 评星
    const result = await scoreText(text);
    res.json(result);
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Server http://localhost:${PORT}`));