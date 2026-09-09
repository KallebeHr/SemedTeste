import { ref } from 'vue';
export const falhaNavegacao = ref(null);
export const navegando = ref(false);
export function ehFalhaDeModulo(e) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading (?:CSS )?chunk|Unable to preload CSS|error loading dynamically imported module/i.test(String(e?.message || e));
}
export function registrarFalha(e, destino = '') {
  navegando.value = false;
  falhaNavegacao.value = {
    modulo: ehFalhaDeModulo(e),
    destino: /^\/(?!\/)/.test(destino) && !/[\\\r\n]/.test(destino) ? destino : window.location.pathname + window.location.search,
  };
}
