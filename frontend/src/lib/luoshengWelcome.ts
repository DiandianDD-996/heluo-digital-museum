const INTRO = /^(?:介绍(?:一下|下)?(?:你自己|自己|你|洛笙)|做个自我介绍|自我介绍|(?:告诉我)?你(?:是|叫)(?:谁|什么|什么名字)|你(?:是|属不属于)(?:AI|人工智能|真人|机器人)(?:吗)?|你的名字(?:是)?什么)$/i
const HELP = /^(?:你(?:可以|能|会)(?:帮我)?(?:做什么|做些什么|讲什么|回答什么)|我(?:能|可以)问(?:你)?什么|你怎么用|怎么(?:用|开始|参观|逛)|(?:请)?带我(?:看看|逛逛|参观)|有什么(?:可以问|推荐看的))$/
const GREETING = /^(?:你?好|您好|嗨|哈[啰喽]|嘿|hello|hi)$/i
const THANKS = /^(?:谢谢(?:你|洛笙)?|感谢(?:你|洛笙)?|多谢(?:你|洛笙)?|thanks|thank you)$/i

export function answerLuoshengWelcome(question: string): string | undefined {
  const normalized = question.normalize('NFKC').trim().replace(/[。.!?！？~～]+$/u, '')
    .replace(/^(?:你好|您好|嗨)[，,\s]+(?:洛笙[，,\s]*)?|^洛笙[，,\s]*|^(?:请问|请|麻烦你)\s*/u, '').trim()
  if (INTRO.test(normalized)) {
    return '你好，我是洛笙，河洛数字博物馆的 AI 向导。我们正看的这件是青铜鼎的数字模型。你可以跟我找鼎耳、数三足、看纹样，也可以问参考藏品的年代、尺寸和材质。'
  }
  if (HELP.test(normalized)) {
    return '我们可以先找鼎口两侧的鼎耳，再换个角度数三足。你也可以直接问「介绍一下这件鼎」或「这件鼎用什么做的？」有资料可查时，我会附上图版或馆藏记录。'
  }
  if (GREETING.test(normalized)) return '你好，我是洛笙。想先找鼎耳、数三足，还是听我讲讲这件鼎？'
  if (THANKS.test(normalized)) return '不客气，慢慢看。碰到好奇的细节，随时叫我。'
}
