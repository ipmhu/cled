
// ═══════════════════════════════════════════════════════════
// api.js - Capa de Conexión entre CLED y Supabase
// ═══════════════════════════════════════════════════════════

// Configuración de Supabase (REEMPLAZA CON TUS DATOS)
var SUPABASE_CONFIG = {
    url: 'https://lzkbrhefcmzmjscptacl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6a2JyaGVmY216bWpzY3B0YWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Mjk5NTcsImV4cCI6MjA5NjAwNTk1N30.0Ekusl6Gj_SUCkrsaig4F8D6z8WW8bAKClwJA4jPOo8',
};

// ═══════════════════════════════════════════
// CLASE PRINCIPAL DE API
// ═══════════════════════════════════════════
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
        
        if (this.token) {
            headers['Authorization'] = 'Bearer ' + this.token;
        }
        
        return headers;
    }

    async request(endpoint, options) {
        options = options || {};
        var url = this.baseUrl + '/rest/v1/' + endpoint;
        
        var config = {
            method: options.method || 'GET',
            headers: this.getHeaders()
        };

        if (options.body) {
            config.body = JSON.stringify(options.body);
        }

        if (options.params) {
            var queryParts = [];
            for (var key in options.params) {
                if (options.params.hasOwnProperty(key)) {
                    queryParts.push(key + '=' + encodeURIComponent(options.params[key]));
                }
            }
            if (queryParts.length > 0) {
                url += '?' + queryParts.join('&');
            }
        }

        try {
            var response = await fetch(url, config);
            
            if (!response.ok) {
                var error = await response.json().catch(function() { 
                    return { message: 'Error ' + response.status }; 
                });
                throw new Error(error.message || 'Error ' + response.status);
            }

            if (response.status === 204) {
                return { success: true, data: null };
            }

            var data = await response.json();
            return { success: true, data: data };
        } catch (err) {
            console.error('API Error:', err);
            return { success: false, error: err.message, data: null };
        }
    }

    async login(codigo, password) {
        try {
            var result = await this.request('miembros', {
                params: {
                    codigo: 'eq.' + codigo,
                    select: 'id,codigo,email,password_hash,nombres,apellidos,telefono,grado,seccion,modulo,estado,rol_id,club_id,foto_url,tutorial_visto,terminos_aceptados'
                }
            });

            if (!result.success || !result.data || result.data.length === 0) {
                return { success: false, msg: 'Usuario no encontrado' };
            }

            var miembro = result.data[0];

            // Verificar contraseña
            if (miembro.password_hash !== password) {
                return { success: false, msg: 'Contraseña incorrecta' };
            }

            var rolNombre = 'Participante';
            if (miembro.rol_id) {
                var rolResult = await this.request('roles', {
                    params: {
                        id: 'eq.' + miembro.rol_id,
                        select: 'nombre,nivel_acceso'
                    }
                });
                if (rolResult.success && rolResult.data && rolResult.data.length > 0) {
                    rolNombre = rolResult.data[0].nombre;
                }
            }

            var clubNombre = 'TODOS';
            var clubId = null;
            if (miembro.club_id) {
                clubId = miembro.club_id;
                var clubResult = await this.request('clubes', {
                    params: {
                        id: 'eq.' + miembro.club_id,
                        select: 'nombre,icono,color'
                    }
                });
                if (clubResult.success && clubResult.data && clubResult.data.length > 0) {
                    clubNombre = clubResult.data[0].nombre;
                }
            }

            var sesion = {
                id: miembro.id,
                codigo: miembro.codigo,
                nombre: miembro.nombres + ' ' + miembro.apellidos,
                email: miembro.email,
                telefono: miembro.telefono || '',
                grado: miembro.grado || '',
                seccion: miembro.seccion || '',
                modulo: miembro.modulo || '',
                estado: miembro.estado,
                rol: rolNombre,
                club: clubNombre,
                clubId: clubId,
                foto: miembro.foto_url || null,
                tutorialVisto: miembro.tutorial_visto || false,
                terminosAceptados: miembro.terminos_aceptados || false
            };

            localStorage.setItem('CLED_SESSION', JSON.stringify(sesion));
            
            return { success: true, member: sesion };
        } catch (err) {
            console.error('Login error:', err);
            return { success: false, msg: 'Error al iniciar sesión' };
        }
    }

    async getAnuncios(club) {
        var filterParams = {
            select: '*',
            order: 'fecha_publicacion.desc',
            activo: 'eq.true'
        };

        if (club && club !== 'TODOS') {
            filterParams.or = '(es_global.eq.true,club_id.is.null)';
        }

        return await this.request('anuncios', { params: filterParams });
    }

    async publicarAnuncio(datos) {
        var body = {
            titulo: datos.titulo,
            contenido: datos.contenido,
            tipo: datos.tipo || 'informativo',
            es_global: datos.esGlobal || false,
            club_id: datos.esGlobal ? null : datos.clubId,
            autor_id: datos.autorId,
            autor_nombre: datos.autorNombre,
            fecha_publicacion: new Date().toISOString(),
            activo: true
        };

        return await this.request('anuncios', { method: 'POST', body: body });
    }

    async getReuniones(club) {
        var filterParams = {
            select: '*',
            order: 'fecha.asc',
            estado: 'eq.programada'
        };

        if (club && club !== 'TODOS') {
            filterParams.or = '(es_global.eq.true,club_id.is.null)';
        }

        return await this.request('reuniones', { params: filterParams });
    }

    async crearReunion(datos) {
        var body = {
            titulo: datos.titulo,
            tipo: datos.tipo,
            fecha: datos.fecha,
            hora: datos.hora,
            objetivo: datos.objetivo || null,
            link_reunion: datos.link,
            organizador_id: datos.organizadorId,
            organizador_nombre: datos.organizadorNombre,
            es_global: datos.esGlobal || false,
            club_id: datos.esGlobal ? null : datos.clubId,
            estado: 'programada'
        };

        return await this.request('reuniones', { method: 'POST', body: body });
    }

    async getAsistencia(miembroId) {
        return await this.request('asistencias', {
            params: {
                miembro_id: 'eq.' + miembroId,
                select: '*',
                order: 'fecha.desc'
            }
        });
    }

    async guardarAsistencia(datos) {
        var resultados = [];
        for (var i = 0; i < datos.length; i++) {
            var d = datos[i];
            var body = {
                miembro_id: d.miembroId,
                club_id: d.clubId,
                fecha: d.fecha,
                modulo_tema: d.modulo,
                estado: d.estado,
                registrado_por: d.registradoPor,
                registrado_en: new Date().toISOString()
            };
            var result = await this.request('asistencias', { method: 'POST', body: body });
            resultados.push(result);
        }

        return { success: resultados.every(function(r) { return r.success; }), data: resultados };
    }

    async getCalificaciones(miembroId) {
        var visibleGlobal = localStorage.getItem('CLED_CALIF_VISIBLE') !== 'false';
        
        var result = await this.request('calificaciones', {
            params: {
                miembro_id: 'eq.' + miembroId,
                select: '*',
                order: 'fecha_publicacion.desc'
            }
        });

        if (result.success && result.data && !visibleGlobal) {
            result.data = result.data.filter(function(c) { return c.visible === true; });
        }

        return result;
    }

    async publicarCalificaciones(datos) {
        var resultados = [];
        for (var i = 0; i < datos.length; i++) {
            var d = datos[i];
            var body = {
                miembro_id: d.miembroId,
                club_id: d.clubId,
                modulo: d.modulo,
                actividad: d.actividad,
                nota: d.nota,
                observacion: d.observacion || null,
                visible: true,
                visibilidad_global: true,
                publicado_por: d.publicadoPor,
                fecha_publicacion: new Date().toISOString()
            };
            var result = await this.request('calificaciones', { method: 'POST', body: body });
            resultados.push(result);
        }

        return { success: resultados.some(function(r) { return r.success; }), data: resultados };
    }

    toggleVisibilidadCalificaciones(visible) {
        localStorage.setItem('CLED_CALIF_VISIBLE', visible ? 'true' : 'false');
        return { success: true };
    }

    async getMiembros(filtros) {
        filtros = filtros || {};
        var params = {
            select: '*,roles(nombre),clubes(nombre)',
            order: 'nombres.asc'
        };

        if (filtros.clubId) {
            params.club_id = 'eq.' + filtros.clubId;
        }

        if (filtros.estado && filtros.estado !== 'TODOS') {
            params.estado = 'eq.' + filtros.estado;
        }

        return await this.request('miembros', { params: params });
    }

    async getFichaMiembro(miembroId) {
        var miembroResult = await this.request('miembros', {
            params: {
                id: 'eq.' + miembroId,
                select: '*,roles(nombre),clubes(nombre)'
            }
        });

        if (!miembroResult.success || !miembroResult.data || miembroResult.data.length === 0) {
            return { success: false, error: 'Miembro no encontrado' };
        }

        var miembro = miembroResult.data[0];
        var asistenciaResult = await this.getAsistencia(miembroId);
        var porcentaje = 0;
        
        if (asistenciaResult.success && asistenciaResult.data && asistenciaResult.data.length > 0) {
            var total = asistenciaResult.data.length;
            var presentes = asistenciaResult.data.filter(function(a) { return a.estado === 'Presente'; }).length;
            porcentaje = Math.round((presentes / total) * 100);
        }

        var historialResult = await this.request('historial_miembros', {
            params: {
                miembro_id: 'eq.' + miembroId,
                select: '*',
                order: 'created_at.desc',
                limit: 10
            }
        });

        return {
            success: true,
            data: {
                codigo: miembro.codigo,
                nombres: miembro.nombres,
                apellidos: miembro.apellidos,
                email: miembro.email,
                telefono: miembro.telefono,
                grado: miembro.grado,
                seccion: miembro.seccion,
                modulo: miembro.modulo,
                estado: miembro.estado,
                fecha_ingreso: miembro.fecha_ingreso,
                roles: miembro.roles,
                clubes: miembro.clubes,
                porcentajeAsistencia: porcentaje,
                historial: historialResult.data || []
            }
        };
    }

    async cambiarEstadoMiembro(miembroId, nuevoEstado) {
        return await this.request('miembros', {
            method: 'PATCH',
            params: { id: 'eq.' + miembroId },
            body: {
                estado: nuevoEstado,
                updated_at: new Date().toISOString()
            }
        });
    }

    async getInscripciones(estado) {
        var params = {
            select: '*',
            order: 'created_at.desc'
        };

        if (estado) {
            params.estado = 'eq.' + estado;
        }

        return await this.request('inscripciones', { params: params });
    }

    async crearInscripcion(datos) {
        var body = {
            nombres: datos.nombres,
            apellidos: datos.apellidos,
            email: datos.email,
            telefono: datos.telefono || null,
            grado: datos.grado,
            seccion: datos.seccion,
            modulo: datos.modulo || null,
            pasantia_dia: datos.pasantia || null,
            club_id: datos.clubId,
            motivo: datos.motivo,
            objetivos: datos.objetivos,
            acepta_terminos: datos.aceptaTerminos,
            acepta_normas: datos.aceptaNormas,
            estado: 'pendiente'
        };

        return await this.request('inscripciones', { method: 'POST', body: body });
    }

    async gestionarInscripcion(inscripcionId, accion, datosAdicionales) {
        datosAdicionales = datosAdicionales || {};
        var body = {
            fecha_revision: new Date().toISOString(),
            revisado_por: datosAdicionales.revisadoPor || null
        };

        switch (accion) {
            case 'aceptar':
                body.estado = 'aceptado';
                break;
            case 'rechazar':
                body.estado = 'rechazado';
                body.motivo_rechazo = datosAdicionales.motivo || '';
                break;
            case 'entrevista':
                body.estado = 'entrevista_pendiente';
                body.entrevista_solicitada = true;
                break;
            case 'resultado_entrevista':
                body.estado = datosAdicionales.aceptado ? 'aceptado' : 'rechazado';
                body.entrevista_resultado = datosAdicionales.aceptado;
                body.entrevista_observaciones = datosAdicionales.observaciones || '';
                break;
        }

        return await this.request('inscripciones', {
            method: 'PATCH',
            params: { id: 'eq.' + inscripcionId },
            body: body
        });
    }

    async getEventos() {
        return await this.request('eventos', {
            params: {
                select: '*',
                estado: 'eq.programado',
                order: 'fecha.asc'
            }
        });
    }

    async confirmarAsistenciaEvento(datos) {
        // Generar código de 6 dígitos
        var codigo = '';
        for (var i = 0; i < 6; i++) {
            codigo += Math.floor(Math.random() * 10);
        }

        var body = {
            evento_id: datos.eventoId,
            nombre_completo: datos.nombre,
            email: datos.email,
            telefono: datos.telefono || null,
            curso: datos.curso || null,
            codigo_confirmacion: codigo,
            estado: 'confirmado'
        };

        var result = await this.request('confirmaciones_eventos', { method: 'POST', body: body });

        if (result.success) {
            return { 
                success: true, 
                data: { codigo_confirmacion: codigo, nombre: datos.nombre, email: datos.email }
            };
        }

        return result;
    }

    async verificarCodigoEvento(codigo, verificadorId) {
        var result = await this.request('confirmaciones_eventos', {
            params: {
                codigo_confirmacion: 'eq.' + codigo,
                select: '*,eventos!inner(titulo,fecha)'
            }
        });

        if (!result.success || !result.data || result.data.length === 0) {
            return { success: false, msg: 'Código no encontrado' };
        }

        var confirmacion = result.data[0];

        if (confirmacion.checkin_realizado) {
            return { success: false, msg: 'Código ya utilizado' };
        }

        await this.request('confirmaciones_eventos', {
            method: 'PATCH',
            params: { id: 'eq.' + confirmacion.id },
            body: {
                checkin_realizado: true,
                checkin_fecha: new Date().toISOString(),
                checkin_verificador_id: verificadorId,
                estado: 'checkin_realizado'
            }
        });

        return { success: true, data: confirmacion };
    }

    async getEstadisticasEvento() {
        var result = await this.request('confirmaciones_eventos', {
            params: { select: 'estado' }
        });

        if (!result.success || !result.data) {
            return { 
                success: true, 
                data: { confirmados: 0, presentes: 0, ausentes: 0 }
            };
        }

        var data = result.data;
        return {
            success: true,
            data: {
                confirmados: data.length,
                presentes: data.filter(function(d) { return d.estado === 'checkin_realizado'; }).length,
                ausentes: data.filter(function(d) { return d.estado === 'confirmado'; }).length
            }
        };
    }

    async getDirectiva() {
        return await this.request('directiva', {
            params: {
                select: '*,directiva_fotos(url_foto,es_principal,descripcion),directiva_logros(logro,fecha)',
                activo: 'eq.true',
                order: 'orden.asc'
            }
        });
    }

    async getDashboard() {
        try {
            var resultados = await Promise.all([
                this.request('miembros', { params: { select: 'estado,club_id' } }),
                this.request('inscripciones', { params: { select: 'estado' } }),
                this.request('eventos', { params: { select: 'estado', estado: 'eq.programado' } }),
                this.request('reuniones', { params: { select: 'estado', estado: 'eq.programada' } })
            ]);

            var miembros = resultados[0].data || [];
            var inscripciones = resultados[1].data || [];
            var eventos = resultados[2].data || [];
            var reuniones = resultados[3].data || [];

            return {
                success: true,
                data: {
                    totalMiembros: miembros.length,
                    miembrosActivos: miembros.filter(function(m) { return m.estado === 'Activo'; }).length,
                    inscripcionesPendientes: inscripciones.filter(function(i) { return i.estado === 'pendiente'; }).length,
                    eventosProgramados: eventos.length,
                    reunionesProgramadas: reuniones.length
                }
            };
        } catch (err) {
            console.error('Dashboard error:', err);
            return {
                success: true,
                data: {
                    totalMiembros: 0,
                    miembrosActivos: 0,
                    inscripcionesPendientes: 0,
                    eventosProgramados: 0,
                    reunionesProgramadas: 0
                }
            };
        }
    }

    async getClubes() {
        return await this.request('clubes', {
            params: {
                select: '*',
                activo: 'eq.true',
                order: 'nombre.asc'
            }
        });
    }

    async updateTutorialVisto(miembroId) {
        return await this.request('miembros', {
            method: 'PATCH',
            params: { id: 'eq.' + miembroId },
            body: {
                tutorial_visto: true,
                updated_at: new Date().toISOString()
            }
        });
    }

    async aceptarTerminos(miembroId) {
        return await this.request('miembros', {
            method: 'PATCH',
            params: { id: 'eq.' + miembroId },
            body: {
                terminos_aceptados: true,
                fecha_aceptacion_terminos: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        });
    }
}

// Instancia global
var API = new CLED_API();