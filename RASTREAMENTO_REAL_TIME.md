# Rastreamento em Tempo Real - Documentação

## 📋 Resumo

Foi criada uma nova página no frontend chamada **Rastreamento em Tempo Real** que permite:

1. ✅ Visualizar vídeos analisados em tempo real via streaming
2. ✅ Desenhar uma área de risco (retângulo) sobre o vídeo
3. ✅ Enviar a área de risco para o backend
4. ✅ Detectar objetos dentro da área de risco (backend processa e marca em vermelho)

## 🎯 Funcionalidades Implementadas

### Frontend (`RealTimeTrackingPage.tsx`)

- **Seletor de Vídeo**: Dropdown para escolher qual vídeo analisar
- **Canvas Interativo**: Permite desenhar retângulo clicando e arrastando
- **Visualização em Tempo Real**: Consome o stream do backend via `<img>` tag
- **Envio de Polígono**: Botão para enviar área de risco ao backend
- **Limpeza**: Botão para limpar a área desenhada
- **Feedback Visual**: Mensagens de sucesso/erro após operações

### Backend (já existente, ajustes feitos)

- **Rota `/api/video_stream/<video_filename>`**: Stream MJPEG com detecções YOLO
- **Rota `/api/update_polygon`**: Recebe pontos do polígono (área de risco)
- **Detecção de Objetos**: YOLO detecta objetos e verifica se estão na área de risco
- **Visualização no Stream**: Desenha a área de risco e marca objetos em vermelho quando dentro dela

## 🚀 Como Usar

### 1. Acesse a Página

- Abra o navegador
- Clique em **"Rastreamento em Tempo Real"** na barra lateral

### 2. Selecione um Vídeo

- Escolha um vídeo no dropdown
- O stream começará automaticamente

### 3. Defina a Área de Risco

1. **Desenhe**: Clique e arraste sobre o vídeo para desenhar um retângulo vermelho
2. **Ajuste**: Redesenhe se necessário (o último retângulo substitui o anterior)
3. **Confirme**: Clique em **"Definir Área de Risco"**
4. **Observe**: A área amarela aparecerá no stream e objetos dentro dela ficarão vermelhos

### 4. Limpar Área

- Clique em **"Limpar Área"** para remover o retângulo desenhado

## 🔧 Detalhes Técnicos

### Estrutura de Arquivos Criados/Modificados

```
frontend/src/pages/
├── RealTimeTrackingPage.tsx  ✨ NOVO
└── RealTimeTrackingPage.css  ✨ NOVO

frontend/src/
└── App.tsx  (já estava configurado)

backend/
└── video_processor.py  (ajustes feitos)
```

### Fluxo de Dados

```
Frontend                          Backend
--------                          -------
1. Usuário seleciona vídeo
                        ──────►   2. /api/video_stream/<video>
                                     - Lê vídeo
                                     - Processa com YOLO
                                     - Retorna stream MJPEG

3. Usuário desenha retângulo
   - Canvas sobrepõe imagem
   - Coordenadas são capturadas

4. Clica "Definir Área"
   - Converte 2 pontos em 4 (retângulo → polígono)
   - Normaliza coordenadas (0-1)
                        ──────►   5. POST /api/update_polygon
                                     - Armazena pontos globalmente
                                     - Retorna confirmação

6. Stream atualizado
                        ◄──────   - Desenha área amarela
                                  - Detecta objetos na área
                                  - Marca objetos em vermelho
                                  - Mostra alerta se objeto na área
```

### Formato do Polígono

O frontend envia um array de 4 pontos (retângulo) com coordenadas normalizadas:

```json
{
  "polygon_points": [
    { "x": 0.2, "y": 0.3 },  // top-left
    { "x": 0.8, "y": 0.3 },  // top-right
    { "x": 0.8, "y": 0.7 },  // bottom-right
    { "x": 0.2, "y": 0.7 }   // bottom-left
  ]
}
```

Coordenadas são normalizadas (0.0 a 1.0) para serem independentes da resolução do vídeo.

## 🎨 Estilo Visual

- **Área de Risco Desenhada**: Borda vermelha sólida (3px)
- **Área de Risco no Stream**: Preenchimento amarelo semi-transparente
- **Objetos Detectados**: Verde (fora da área) ou Vermelho (dentro da área)
- **Alerta**: Texto vermelho "OBJETO NA AREA DE RISCO!" no topo do vídeo

## ⚡ Otimizações

1. **Performance do Stream**: Backend processa apenas 1 frame a cada 2 para reduzir carga
2. **Canvas Leve**: Canvas é usado apenas para desenhar, não processa vídeo
3. **Normalização**: Coordenadas normalizadas evitam problemas com diferentes resoluções
4. **CORS Configurado**: Frontend pode acessar backend sem problemas

## 🐛 Solução de Problemas

### Stream não aparece
- Verifique se o backend está rodando em `http://localhost:5000`
- Verifique se o vídeo selecionado existe na pasta `videos/`
- Abra o console do navegador para ver erros

### Área não é detectada
- Certifique-se de desenhar um retângulo completo (clique, arraste, solte)
- Clique em "Definir Área de Risco" após desenhar
- Verifique no console se o POST para `/api/update_polygon` foi bem-sucedido

### Objetos não são detectados
- Verifique se o modelo YOLO está carregado corretamente
- Certifique-se de que o vídeo tem objetos que o YOLO pode detectar

## 📝 Próximos Passos (Sugestões)

- [ ] Permitir desenhar múltiplos polígonos
- [ ] Salvar áreas de risco no banco de dados
- [ ] Adicionar histórico de alertas
- [ ] Notificações em tempo real quando objeto entra na área
- [ ] Suporte para diferentes formas (não apenas retângulos)
- [ ] Dashboard com estatísticas de detecções

## 🎉 Conclusão

A página de **Rastreamento em Tempo Real** está funcionando e pronta para uso! 

Acesse pela sidebar, selecione um vídeo, desenhe uma área de risco e observe o sistema detectando objetos automaticamente. Baby steps implementados com sucesso! 🚀
