export const themes = {
  azure: {
    label: 'Azure',
    appBackground: '#edf4f8',
    sidebar: '#dceaf3',
    preview: '#d3e5f0',
    cover: 'linear-gradient(150deg, #e0f2fb 0%, #b9d8ea 52%, #47718e 100%)',
    border: '#86a9bd',
    accent: '#326d89',
    ink: '#19303b',
  },
  lavender: {
    label: 'Lavender',
    appBackground: '#f3f0fa',
    sidebar: '#e7e0f2',
    preview: '#ded6ed',
    cover: 'linear-gradient(150deg, #f0eafb 0%, #d2c8e7 52%, #71658f 100%)',
    border: '#a798c2',
    accent: '#685585',
    ink: '#302a3c',
  },
  blush: {
    label: 'Blush',
    appBackground: '#fbf0f2',
    sidebar: '#f3dfe4',
    preview: '#ecd5dc',
    cover: 'linear-gradient(150deg, #fcecf0 0%, #edc8d2 52%, #9b6373 100%)',
    border: '#c89ba8',
    accent: '#965568',
    ink: '#3d2930',
  },
  apricot: {
    label: 'Apricot',
    appBackground: '#fdf4e9',
    sidebar: '#f5e3cb',
    preview: '#eed8bb',
    cover: 'linear-gradient(150deg, #fff2df 0%, #f1cfaa 52%, #9d704c 100%)',
    border: '#c9a37b',
    accent: '#94633e',
    ink: '#3c2d20',
  },
} as const

export type ThemeId = keyof typeof themes
