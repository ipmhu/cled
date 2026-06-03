
// ═══════════════════════════════════════════════════════════
// api.js - CLED API para Supabase (PRODUCCIÓN)
// ═══════════════════════════════════════════════════════════


var SUPABASE_CONFIG = {
    url: 'https://lzkbrhefcmzmjscptacl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6a2JyaGVmY216bWpzY3B0YWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Mjk5NTcsImV4cCI6MjA5NjAwNTk1N30.0Ekusl6Gj_SUCkrsaig4F8D6z8WW8bAKClwJA4jPOo8',
};

class CLED_API {
    constructor() {
        this.baseUrl = SUPABASE_CONFIG.url;
        this.anonKey = SUPABASE_CONFIG.anonKey;
        this.token = localStorage.getItem('CLED_TOKEN') || null;
    }

    getHeaders() {
        var headers = {
            'Content-Type': 'application/json',
            'apikey': this.anonKey,
            'Authorization': 'Bearer ' + this.anonKey
        };
        if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
        return headers;
    }

    async request(endpoint, options) {
        options = options || {};
        var url = this.baseUrl + '/rest/v1/' + endpoint;
        var config = { method: options.method || 'GET', headers: this.getHeaders() };
        if (options.body) config.body = JSON.stringify(options.body);
        if (options.params) {
            var parts = [];
            for (var k in options.params) {
                if (options.params.hasOwnProperty(k)) parts.push(k + '=' + encodeURIComponent(options.params[k]));
            }
            if (parts.length) url += '?' + parts.join('&');
        }
        try {
            var resp = await fetch(url, config);
            if (!resp.ok) {
                var err = await resp.json().catch(function() { return { message: 'Error ' + resp.status }; });
                throw new Error(err.message || 'Error');
            }
            if (resp.status === 204) return { success: true, data: null };
            var data = await resp.json();
            return { success: true, data: data };
        } catch (e) {
            console.error('API:', e.message);
            return { success: false, error: e.message, data: null };
        }
    }

    async login(codigo, password) {
        var result = await this.request('miembros', {
            params: { codigo: 'eq.' + codigo, select: '*' }
        });
        if (!result.success || !result.data || !result.data.length) {
            return { success: false, msg: 'Usuario no encontrado' };
        }
        var m = result.data[0];
        if (m.password_hash !== password && m.password !== password) {
            return { success: false, msg: 'Contraseña incorrecta' };
        }
        var sesion = {
            id: m.id, codigo: m.codigo || m.username,
            nombre: m.nombres + ' ' + m.apellidos,
            email: m.email, telefono: m.telefono || '',
            grado: m.grado || '', seccion: m.seccion || '',
            modulo: m.modulo || '', estado: m.estado,
            rol: m.rol || 'Participante',
            club: m.club || 'TODOS', clubId: m.club_id || null,
            tutorialVisto: m.tutorial_visto || false,
            terminosAceptados: m.terminos_aceptados || false
        };
        localStorage.setItem('CLED_SESSION', JSON.stringify(sesion));
        await this.request('miembros', {
            method: 'PATCH', params: { id: 'eq.' + m.id },
            body: { last_login: new Date().toISOString() }
        });
        return { success: true, member: sesion };
    }

    async getMiembros(filtros) {
        filtros = filtros || {};
        var params = { select: '*', order: 'nombres.asc' };
        if (filtros.club) params.club = 'eq.' + filtros.club;
        if (filtros.estado) params.estado = 'eq.' + filtros.estado;
        if (filtros.rol) params.rol = 'eq.' + filtros.rol;
        return await this.request('miembros', { params: params });
    }

    async crearMiembro(datos) {
        return await this.request('miembros', {
            method: 'POST',
            body: {
                codigo: datos.codigo,
                username: datos.username,
                password: datos.password,
                password_hash: datos.password,
                nombres: datos.nombres,
                apellidos: datos.apellidos,
                email: datos.email,
                telefono: datos.telefono || '',
                fecha_nacimiento: datos.fechaNacimiento || null,
                grado: datos.grado || '',
                seccion: datos.seccion || '',
                modulo: datos.modulo || '',
                pasantia_dia: datos.pasantia || '',
                club: datos.club,
                club_id: datos.clubId || null,
                estado: datos.estado || 'Activo',
                rol: datos.rol || 'Participante',
                fecha_ingreso: new Date().toISOString().split('T')[0],
                tutorial_visto: false,
                terminos_aceptados: true
            }
        });
    }

    async cambiarEstadoMiembro(id, estado) {
        return await this.request('miembros', {
            method: 'PATCH', params: { id: 'eq.' + id },
            body: { estado: estado, updated_at: new Date().toISOString() }
        });
    }

    async getInscripciones(estado) {
        var params = { select: '*', order: 'created_at.desc' };
        if (estado) params.estado = 'eq.' + estado;
        return await this.request('inscripciones', { params: params });
    }

    async crearInscripcion(datos) {
        return await this.request('inscripciones', {
            method: 'POST',
            body: {
                nombres: datos.nombres, apellidos: datos.apellidos,
                email: datos.email, telefono: datos.telefono || '',
                fecha_nacimiento: datos.fechaNacimiento || null,
                grado: datos.grado, seccion: datos.seccion || '',
                modulo: datos.modulo || '', pasantia_dia: datos.pasantia || '',
                club: datos.club, club_id: datos.clubId || null,
                motivo: datos.motivo || '', objetivos: datos.objetivos || '',
                username_generado: datos.usernameGenerado,
                password_generado: datos.passwordGenerado,
                acepta_terminos: datos.aceptaTerminos || false,
                acepta_normas: datos.aceptaNormas || false,
                estado: 'pendiente'
            }
        });
    }

    async gestionarInscripcion(id, accion, datosExtra) {
        datosExtra = datosExtra || {};
        var body = { fecha_revision: new Date().toISOString(), revisado_por: datosExtra.revisadoPor };
        if (accion === 'aceptar') body.estado = 'aceptado';
        else if (accion === 'rechazar') { body.estado = 'rechazado'; body.motivo_rechazo = datosExtra.motivo || ''; }
        return await this.request('inscripciones', {
            method: 'PATCH', params: { id: 'eq.' + id }, body: body
        });
    }

    async getAnuncios(club) {
        var params = { select: '*', order: 'fecha_publicacion.desc', activo: 'eq.true' };
        if (club && club !== 'TODOS') params.or = '(es_global.eq.true,club.eq.' + club + ')';
        return await this.request('anuncios', { params: params });
    }

    async publicarAnuncio(datos) {
        return await this.request('anuncios', {
            method: 'POST',
            body: {
                titulo: datos.titulo, contenido: datos.contenido,
                es_global: datos.esGlobal || false,
                club: datos.esGlobal ? 'TODOS' : datos.club,
                club_id: datos.clubId || null,
                autor_id: datos.autorId, autor_nombre: datos.autorNombre,
                fecha_publicacion: new Date().toISOString(), activo: true
            }
        });
    }

    async getReuniones(club) {
        var params = { select: '*', order: 'fecha.asc' };
        if (club && club !== 'TODOS') params.or = '(es_global.eq.true,club.eq.' + club + ')';
        return await this.request('reuniones', { params: params });
    }

async crearReunion(datos) {
    return await this.request('reuniones', {
        method: 'POST',
        body: {
            titulo: datos.titulo,
            tipo: datos.tipo || 'club',
            fecha: datos.fecha,
            hora: datos.hora,
            objetivo: datos.objetivo || null,
            link_reunion: datos.link,
            es_global: datos.esGlobal || false,
            club: datos.club || 'TODOS',
            club_id: datos.clubId || null,
            organizador_id: datos.organizadorId,
            organizador_nombre: datos.organizadorNombre,
            persona_id: datos.personaId || null,
            persona_nombre: datos.personaNombre || null,
            personas_multiples: datos.personasMultiples ? JSON.stringify(datos.personasMultiples) : null,
            estado: 'programada'
        }
    });
}

    async getAsistencia(miembroId) {
        return await this.request('asistencias', {
            params: { miembro_id: 'eq.' + miembroId, select: '*', order: 'fecha.desc' }
        });
    }

    async guardarAsistencia(lista) {
        var resultados = [];
        for (var i = 0; i < lista.length; i++) {
            var d = lista[i];
            var r = await this.request('asistencias', {
                method: 'POST',
                body: { miembro_id: d.miembroId, club_id: d.clubId, fecha: d.fecha, modulo_tema: d.modulo, estado: d.estado, registrado_por: d.registradoPor }
            });
            resultados.push(r);
        }
        return { success: resultados.every(function(r) { return r.success; }) };
    }

    async getCalificaciones(miembroId) {
        var visible = localStorage.getItem('CLED_CALIF_VISIBLE') !== 'false';
        var r = await this.request('calificaciones', {
            params: { miembro_id: 'eq.' + miembroId, select: '*', order: 'fecha_publicacion.desc' }
        });
        if (r.success && r.data && !visible) r.data = r.data.filter(function(c) { return c.visible === true; });
        return r;
    }

    async publicarCalificaciones(lista) {
        var resultados = [];
        for (var i = 0; i < lista.length; i++) {
            var d = lista[i];
            var r = await this.request('calificaciones', {
                method: 'POST',
                body: { miembro_id: d.miembroId, club_id: d.clubId, modulo: d.modulo, actividad: d.actividad, nota: d.nota, observacion: d.observacion || null, visible: true, visibilidad_global: true, publicado_por: d.publicadoPor }
            });
            resultados.push(r);
        }
        return { success: resultados.some(function(r) { return r.success; }) };
    }

    toggleVisibilidadCalificaciones(v) {
        localStorage.setItem('CLED_CALIF_VISIBLE', v ? 'true' : 'false');
        return { success: true };
    }

    async getEventos() {
        return await this.request('eventos', {
            params: { select: '*', estado: 'eq.programado', order: 'fecha.asc' }
        });
    }

    async confirmarAsistenciaEvento(datos) {
        var codigo = '';
        for (var i = 0; i < 6; i++) codigo += Math.floor(Math.random() * 10);
        var r = await this.request('confirmaciones_eventos', {
            method: 'POST',
            body: { evento_id: datos.eventoId, nombre_completo: datos.nombre, email: datos.email, telefono: datos.telefono || '', curso: datos.curso || '', codigo_confirmacion: codigo, estado: 'confirmado' }
        });
        if (r.success) r.data = { codigo_confirmacion: codigo, nombre: datos.nombre };
        return r;
    }

    async verificarCodigoEvento(codigo, verificadorId) {
        var r = await this.request('confirmaciones_eventos', {
            params: { codigo_confirmacion: 'eq.' + codigo, select: '*' }
        });
        if (!r.success || !r.data || !r.data.length) return { success: false, msg: 'Código no encontrado' };
        var c = r.data[0];
        if (c.checkin_realizado) return { success: false, msg: 'Código ya utilizado' };
        await this.request('confirmaciones_eventos', {
            method: 'PATCH', params: { id: 'eq.' + c.id },
            body: { checkin_realizado: true, checkin_fecha: new Date().toISOString(), checkin_verificador_id: verificadorId, estado: 'checkin_realizado' }
        });
        return { success: true, data: c };
    }

    async getEstadisticasEvento() {
        var r = await this.request('confirmaciones_eventos', { params: { select: 'estado' } });
        if (!r.success || !r.data) return { success: true, data: { confirmados: 0, presentes: 0, ausentes: 0 } };
        var d = r.data;
        return { success: true, data: { confirmados: d.length, presentes: d.filter(function(x) { return x.estado === 'checkin_realizado'; }).length, ausentes: d.filter(function(x) { return x.estado === 'confirmado'; }).length } };
    }

    async getDashboard() {
        var resultados = await Promise.all([
            this.request('miembros', { params: { select: 'estado,club' } }),
            this.request('inscripciones', { params: { select: 'estado' } }),
            this.request('eventos', { params: { select: 'estado' } }),
            this.request('reuniones', { params: { select: 'estado' } })
        ]);
        var m = resultados[0].data || [], i = resultados[1].data || [], e = resultados[2].data || [], r = resultados[3].data || [];
        return { success: true, data: { totalMiembros: m.length, miembrosActivos: m.filter(function(x) { return x.estado === 'Activo'; }).length, inscripcionesPendientes: i.filter(function(x) { return x.estado === 'pendiente'; }).length, eventosProgramados: e.length, reunionesProgramadas: r.length } };
    }

    async updateTutorialVisto(id) {
        return await this.request('miembros', { method: 'PATCH', params: { id: 'eq.' + id }, body: { tutorial_visto: true, updated_at: new Date().toISOString() } });
    }

    async aceptarTerminos(id) {
        return await this.request('miembros', { method: 'PATCH', params: { id: 'eq.' + id }, body: { terminos_aceptados: true, fecha_aceptacion_terminos: new Date().toISOString(), updated_at: new Date().toISOString() } });
    }

    async getClubes() {
        return await this.request('clubes', { params: { select: '*', activo: 'eq.true' } });
    }

    async getDirectiva() {
        return await this.request('directiva', { params: { select: '*,directiva_fotos(url_foto),directiva_logros(logro)', activo: 'eq.true', order: 'orden.asc' } });
    }
}

var API = new CLED_API();
