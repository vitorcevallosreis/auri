// Função para gerar uma cor consistente baseada no nome do canal
export function getChannelColor(channelName: string): string {
  // Lista de cores vibrantes para os canais
  const colors = [
    '#4CAF50', // Verde
    '#2196F3', // Azul
    '#9C27B0', // Roxo
    '#FF9800', // Laranja
    '#E91E63', // Rosa
    '#00BCD4', // Ciano
    '#3F51B5', // Índigo
    '#F44336', // Vermelho
    '#009688', // Verde-azulado
    '#673AB7', // Roxo profundo
    '#FF5722', // Laranja profundo
    '#795548', // Marrom
    '#607D8B', // Azul acinzentado
  ];

  // Extrair o nome do canal (parte antes do underscore)
  const name = channelName?.split('_')[0] || channelName;

  // Função de hash simples para converter o nome em um índice
  let hash = 0;
  if (name) {
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
  }

  // Converter o hash em um índice dentro do array de cores
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}
