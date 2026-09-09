import { createRouter, createWebHistory } from "vue-router";
import { PAGINAS } from "../portal/catalogo";
import { destinoAdministrativo } from "../portal/permissoes";
import { navegando, falhaNavegacao, registrarFalha } from '../portal/navegacao';
const lista = () => import("../views/portal/ListaPublica.vue");
const rotas = [
  {
    path: "/",
    component: () => import("../pages/index.vue"),
    meta: { titulo: "Início" },
  },
  {
    path: "/busca",
    component: () => import("../views/portal/BuscaView.vue"),
    meta: { titulo: "Busca" },
  },
  {
    path: "/carta-de-servicos",
    component: () => import("../views/portal/ServicosView.vue"),
    meta: { titulo: "Carta de serviços" },
  },
  {
    path: "/servico/:id",
    component: () => import("../views/portal/ServicoDetalhe.vue"),
    meta: { titulo: "Orientações do serviço" },
  },
  {
    path: "/noticias",
    component: lista,
    meta: {
      titulo: "Notícias da educação",
      descricao:
        "Acompanhe as publicações da Secretaria Municipal de Educação.",
      tipo: "noticia",
    },
  },
  {
    path: "/biblioteca-digital",
    component: lista,
    meta: {
      titulo: "Biblioteca digital",
      descricao:
        "Livros, materiais didáticos e recursos educacionais publicados para a comunidade.",
      tipo: "biblioteca",
    },
  },
  {
    path: "/transporte-escolar",
    component: lista,
    meta: {
      titulo: "Transporte escolar",
      descricao: "Consulte rotas e horários publicados e solicite atendimento.",
      tipo: "transporte",
    },
  },
  {
    path: "/publicacao/:id",
    component: () => import("../views/portal/PublicacaoView.vue"),
    meta: { titulo: "Publicação" },
  },
  {
    path: "/calendario",
    component: () => import("../components/OneCalendario.vue"),
    meta: { titulo: "Calendário escolar" },
  },
  {
    path: "/editais",
    component: () => import("../components/OneEdital.vue"),
    meta: { titulo: "Editais e concursos" },
  },
  {
    path: "/escolas",
    component: () => import("../views/portal/EscolasPublicas.vue"),
    meta: { titulo: "Escolas" },
  },
  {
    path: "/merenda-escolar",
    component: () => import("../views/portal/MerendaPublica.vue"),
    meta: { titulo: "Merenda escolar" },
  },
  {
    path: "/matricula",
    component: () => import("../views/portal/MatriculaView.vue"),
    meta: { titulo: "Matrícula escolar" },
  },
  {
    path: "/fale-conosco",
    component: () => import("../views/portal/ContatoView.vue"),
    meta: { titulo: "Fale conosco" },
  },
  {
    path: "/atendimento",
    component: () => import("../views/portal/AtendimentoView.vue"),
    meta: { titulo: "Atendimento" },
  },
  {
    path: "/boletim",
    component: () => import("../views/portal/BoletimView.vue"),
    meta: { titulo: "Boletim escolar" },
  },
  {
    path: "/acessibilidade",
    component: () => import("../views/portal/AcessibilidadeView.vue"),
    meta: { titulo: "Acessibilidade" },
  },
  {
    path: "/mapa-do-site",
    component: () => import("../views/portal/MapaView.vue"),
    meta: { titulo: "Mapa do site" },
  },
  ...PAGINAS.map(([slug, titulo]) => ({
    path: "/" + slug,
    component: () => import("../views/portal/PaginaInstitucional.vue"),
    meta: { slug, titulo },
  })),
  { path: "/transparencia/relatorio", redirect: "/transparencia" },
  {
    path: "/login",
    component: () => import("../views/LoginAlimentacaoView.vue"),
    meta: { titulo: "Acesso à administração", login: true },
  },
  {
    path: "/login-alimentacao",
    redirect: (to) => ({
      path: "/login",
      query: { redirect: destinoAdministrativo(to.query.redirect) },
    }),
  },
  {
    path: "/administracao",
    component: () => import("../views/admin/AdminLayout.vue"),
    meta: { requerAuth: true },
    children: [
      {path:'parametros',component:()=>import('../views/admin/ParametrosAdmin.vue'),meta:{titulo:'Parâmetros',permissao:'parametros'}},
      { path:'relatorios',component:()=>import('../views/admin/RelatoriosAdmin.vue'),meta:{titulo:'Indicadores e relatórios',permissao:'merenda'} },
      { path:'notificacoes',component:()=>import('../views/admin/NotificacoesView.vue'),meta:{titulo:'Notificações e pendências'} },
      {
        path: "",
        component: () => import("../views/admin/DashboardAdmin.vue"),
        meta: { titulo: "Administração" },
      },
      {
        path: "conteudos",
        component: () => import("../views/admin/ConteudosAdmin.vue"),
        meta: { titulo: "Conteúdos", permissao: "conteudo" },
      },
      {
        path: "cardapios",
        component: () => import("../views/admin/ConteudosAdmin.vue"),
        meta: { titulo: "Cardápios", permissao: "nutricao" },
      },
      {
        path: "configuracao",
        component: () => import("../views/admin/ConfiguracaoAdmin.vue"),
        meta: { titulo: "Configuração do portal", permissao: "configuracao" },
      },
      {
        path: "escolas",
        component: () => import("../views/admin/EscolasAdmin.vue"),
        meta: { titulo: "Escolas", permissao: "escolas" },
      },
      {
        path: "merenda",
        component: () => import("../views/PainelEscolaView.vue"),
        meta: { titulo: "Gestão da alimentação", permissao: "merenda" },
      },
      {
        path: "vistorias",
        component: () => import("../views/admin/VistoriasPublicacao.vue"),
        meta: { titulo: "Publicar vistorias", permissao: "nutricao" },
      },
      {
        path: "usuarios",
        component: () => import("../views/admin/UsuariosAdmin.vue"),
        meta: { titulo: "Usuários", permissao: "usuarios" },
      },
      {
        path: "solicitacoes",
        component: () => import("../views/admin/SolicitacoesAdmin.vue"),
        meta: { titulo: "Solicitações", permissao: "atendimentos" },
      },
      {
        path: "alunos",
        component: () => import("../views/admin/AlunosAdmin.vue"),
        meta: { titulo: "Alunos", permissao: "alunos" },
      },
      {
        path: "notas",
        component: () => import("../views/admin/NotasAdmin.vue"),
        meta: { titulo: "Notas", permissao: "notas" },
      },
      {
        path: "boletim/:id",
        component: () => import("../views/admin/BoletimDiretor.vue"),
        meta: { titulo: "Boletim", permissao: "alunos" },
      },
      {
        path: "auditoria",
        component: () => import("../views/admin/AuditoriaPortal.vue"),
        meta: { titulo: "Auditoria", permissao: "auditoria" },
      },
      {
        path: "recuperacao",
        component: () => import("../views/admin/RecuperacaoAdmin.vue"),
        meta: { titulo: "Recuperação e ambiente", permissao: "recuperacao" },
      },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    component: () => import("../views/portal/NaoEncontrado.vue"),
    meta: { titulo: "Página não encontrada" },
  },
];
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: rotas,
  scrollBehavior(to, from, saved) {
    return saved || { top: 0 };
  },
});
router.beforeEach(async (to) => {
  navegando.value = true;
  if (!to.meta.requerAuth && !to.meta.login) return true;
  const { aguardarAutenticacao, useAuth } =
    await import("../composables/useAuth");
  await aguardarAutenticacao();
  const { usuario, pode } = useAuth();
  if (to.meta.requerAuth && !usuario.value)
    return { path: "/login", query: { redirect: to.fullPath } };
  if (to.meta.permissao && !pode(to.meta.permissao)) return "/administracao";
  if (to.meta.login && usuario.value) return "/administracao";
  return true;
});
router.afterEach((to, from, failure) => {
  navegando.value = false;
  if (failure) return;
  falhaNavegacao.value = null;
  document.title = `${to.meta.titulo || "Portal"} · Educação de Pedro II`;
});
router.onError((e, to) => registrarFalha(e, to?.fullPath));
window.addEventListener('vite:preloadError', (e) => registrarFalha(e.payload));
export default router;
