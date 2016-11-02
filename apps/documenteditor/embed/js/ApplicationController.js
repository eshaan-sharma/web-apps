/*
 *
 * (c) Copyright Ascensio System Limited 2010-2016
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA at Lubanas st. 125a-25, Riga, Latvia,
 * EU, LV-1021.
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * Pursuant to Section 7(b) of the License you must retain the original Product
 * logo when distributing the program. Pursuant to Section 7(e) we decline to
 * grant you any rights under trademark law for use of our trademarks.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
*/
var ApplicationController = new(function(){
    var me,
        api,
        config = {},
        docConfig = {},
        embedConfig = {},
        permissions = {},
        maxPages = 0,
        minEmbedWidth = 400,
        minEmbedHeight = 600,
        embedCode = '<iframe allowtransparency="true" frameborder="0" scrolling="no" src="{embed-url}" width="{width}" height="{height}"></iframe>',
        created = false,
        ttOffset = [0, -10];

    // Initialize analytics
    // -------------------------

//    Common.Analytics.initialize('UA-12442749-13', 'Embedded ONLYOFFICE Document');


    // Check browser
    // -------------------------

    if (typeof isBrowserSupported !== 'undefined' && !isBrowserSupported()){
        Common.Gateway.reportError(undefined, 'Your browser is not supported.');
        return;
    }


    // Utils
    // -------------------------

    function htmlEncode(value){
        return $('<div/>').text(value).html();
    }

    // Handlers
    // -------------------------

    function loadConfig(data) {
        config = $.extend(config, data.config);
        embedConfig = $.extend(embedConfig, data.config.embedded);

        if ( !embedConfig.shareUrl )
            $('#idt-share').hide();

        if ( !embedConfig.embedUrl )
            $('#idt-embed').hide();

        if (typeof embedConfig.fullscreenUrl === 'undefined')
            $('#idt-fullscr').hide();

        if (config.canBackToFolder === false || !(config.customization && config.customization.goback && config.customization.goback.url))
            $('#id-btn-close').hide();


        // Docked toolbar
        if (embedConfig.toolbarDocked === 'top') {
            $('#toolbar').addClass('top');
            $('#editor_sdk').addClass('top');
        } else {
            $('#toolbar').addClass('bottom');
            $('#editor_sdk').addClass('bottom');
        }

        // Hide last separator
        if (!$('#id-btn-close').is(":visible")) {
            $('#toolbar .right .separator').hide();
            $('#pages').css('margin-right', '12px');
        }
    }

    function loadDocument(data) {
        docConfig = data.doc;

        if (docConfig) {
            permissions = $.extend(permissions, docConfig.permissions);

            var docInfo = new Asc.asc_CDocInfo();
            docInfo.put_Id(docConfig.key);
            docInfo.put_Url(docConfig.url);
            docInfo.put_Title(docConfig.title);
            docInfo.put_Format(docConfig.fileType);
            docInfo.put_VKey(docConfig.vkey);

            if (api) {
                api.asc_registerCallback('asc_onGetEditorPermissions', onEditorPermissions);
                api.asc_setDocInfo(docInfo);
                api.asc_getEditorPermissions(config.licenseUrl, config.customerId);
                api.asc_enableKeyEvents(true);

                Common.Analytics.trackEvent('Load', 'Start');
            }

            if ( !embedConfig.saveUrl && permissions.print === false)
                $('#idt-copy').hide();
        }
    }

    function onCountPages(count) {
        maxPages = count;
        $('#pages').text('of ' + count);
    }

    function onCurrentPage(number) {
        $('#page-number').val(number + 1);
    }

    function onLongActionBegin(type, id) {
        var text = '';
        switch (id)
        {
            case Asc.c_oAscAsyncAction['Print']:
                text = 'Downloading document...';
                break;
            default:
                text = 'Please wait...';
                break;
        }

        if (type == Asc.c_oAscAsyncActionType['BlockInteraction']) {
            $('#id-loadmask .cmd-loader-title').html(text);
            showMask();
        }
    }

    function onLongActionEnd(){
        hideMask();
    }

    function onDocMouseMoveStart() {
        me.isHideBodyTip = true;
    }

    function onDocMouseMoveEnd() {
        if (me.isHideBodyTip) {
            if ( $tooltip ) {
                $tooltip.tooltip('hide');
                $tooltip = false;
            }
        }
    }

    var $ttEl, $tooltip;
    function onDocMouseMove(data) {
        if (data) {
            if (data.get_Type() == 1) { // hyperlink
                me.isHideBodyTip = false;

                if ( !$ttEl ) {
                    $ttEl = $('.hyperlink-tooltip');
                    $ttEl.tooltip({'container':'body', 'trigger':'manual'});
                    $ttEl.on('shown.bs.tooltip', function(e) {
                        $tooltip = $ttEl.data('bs.tooltip').tip();

                        $tooltip.css({
                            left: $ttEl.ttpos[0] - 10,
                            top: $ttEl.ttpos[1] - 5
                        });

                        $tooltip.find('.tooltip-arrow').css({left: 10});
                    });
                }

                if ( !$tooltip ) {
                    $ttEl.ttpos = [data.get_X(), data.get_Y()];
                    $ttEl.tooltip('show');
                } else {
                    $tooltip.css({
                        left:data.get_X() - 10,
                        top:data.get_Y() - 5
                    });
                }
            }
        }
    }

    function onDownloadUrl(url) {
        Common.Gateway.downloadAs(url);
    }

    function onPrint() {
        if (api && permissions.print!==false)
            api.asc_Print($.browser.chrome || $.browser.safari || $.browser.opera);
    }

    function onPrintUrl(url) {
        common.utils.dialogPrint(url);
    }

    function hidePreloader() {
        $('#loading-mask').fadeOut('slow');
    }

    function onDocumentContentReady() {
        hidePreloader();

        ApplicationView.modals.create(embedConfig);

        api.asc_registerCallback('asc_onStartAction',           onLongActionBegin);
        api.asc_registerCallback('asc_onEndAction',             onLongActionEnd);
        api.asc_registerCallback('asc_onMouseMoveStart',        onDocMouseMoveStart);
        api.asc_registerCallback('asc_onMouseMoveEnd',          onDocMouseMoveEnd);
        api.asc_registerCallback('asc_onMouseMove',             onDocMouseMove);
        api.asc_registerCallback('asc_onHyperlinkClick',        common.utils.openLink);
        api.asc_registerCallback('asc_onDownloadUrl',           onDownloadUrl);
        api.asc_registerCallback('asc_onPrint',                 onPrint);

        Common.Gateway.on('processmouse',       onProcessMouse);
        Common.Gateway.on('downloadas',         onDownloadAs);

        function _copytext(el, event) {
            el.select();
            if ( !document.execCommand('copy') ) {
                window.alert('Browser\'s error! Use keyboard shortcut [Ctrl] + [C]');
            }
        }

        var m = ApplicationView.modals.get('share');
        m.find('#btn-copyshort').on('click', _copytext.bind(this, m.find('#id-short-url')));
        m.find('.share-buttons > span').on('click', function(e){
            var _url;
            switch ($(e.target).attr('data-name')) {
            case 'facebook':
                _url = 'https://www.facebook.com/sharer/sharer.php?u=' + embedConfig.shareUrl + '&t=' + embedConfig.docTitle;
                window.open(_url, '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=300,width=600');
                break;
            case 'twitter':
                _url = 'https://twitter.com/share?url='+ embedConfig.shareUrl;
                !!embedConfig.docTitle && (_url += '&text=' + embedConfig.docTitle);
                window.open(_url, '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=300,width=600');
                break;
            case 'gplus':
                _url = 'https://plus.google.com/share?url=' + embedConfig.shareUrl;
                window.open(_url, '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes');
                break;
            case 'email':
                window.open('mailto:?subject=I have shared a document with you: ' + embedConfig.docTitle + '&body=I have shared a document with you: ' + embedConfig.shareUrl + '"', '_self');
                break;
            }
        });

        var dlgembed = ApplicationView.modals.get('embed');
        var txtembed = dlgembed.find('#txt-embed-url');
        txtembed.text(embedCode.replace('{embed-url}', embedConfig.embedUrl).replace('{width}', minEmbedWidth).replace('{height}', minEmbedHeight));
        dlgembed.find('#btn-copyembed').on('click', _copytext.bind(this, txtembed));
        dlgembed.find('#txt-embed-width, #txt-embed-height').on({
            'keypress': function(e){
                if (e.keyCode == 13)
                    updateEmbedCode();
            }
            , 'focusout': function(e){
                updateEmbedCode();
            }
        });

        ApplicationView.tools.get('#idt-fullscreen')
            .on('click', function(){
                common.utils.openLink(embedConfig.fullscreenUrl);
            });

        ApplicationView.tools.get('#idt-download')
            .on('click', function(){
                    if ( !!embedConfig.saveUrl ){
                        common.utils.openLink(embedConfig.saveUrl);
                    } else
                    if (api && permissions.print!==false){
                        api.asc_Print($.browser.chrome || $.browser.safari || $.browser.opera);
                    }

                    Common.Analytics.trackEvent('Save');
            });

        $('#id-btn-close').on('click', function(){
            if (config.customization && config.customization.goback && config.customization.goback.url)
                window.parent.location.href = config.customization.goback.url;
        });

        $('#id-btn-zoom-in').on('click', api.zoomIn.bind(this));
        $('#id-btn-zoom-out').on('click', api.zoomOut.bind(this));

        var $pagenum = $('#page-number');
        $pagenum.on({
            'keyup': function(e){
                if ( e.keyCode == 13 ){
                    var newPage = parseInt($('#page-number').val());

                    if ( newPage > maxPages ) newPage = maxPages;
                    if (newPage < 2 || isNaN(newPage)) newPage = 1;

                    api.goToPage(newPage-1);
                    $pagenum.blur();
                }
            }
            , 'focusin' : function(e) {
                $pagenum.removeClass('masked');
            }
            , 'focusout': function(e){
                !$pagenum.hasClass('masked') && $pagenum.addClass('masked');
            }
        });

        $('#pages').on('click', function(e) {
            $pagenum.focus();
        });

        var documentMoveTimer;
        var ismoved = false;
        $(document).mousemove(function(event){
            $('#id-btn-zoom-in').fadeIn();
            $('#id-btn-zoom-out').fadeIn();

            ismoved = true;
            if ( !documentMoveTimer ) {
                documentMoveTimer = setInterval(function(){
                    if ( !ismoved ) {
                        $('#id-btn-zoom-in').fadeOut();
                        $('#id-btn-zoom-out').fadeOut();
                        clearInterval(documentMoveTimer);
                        documentMoveTimer = undefined;
                    }

                    ismoved = false;
                }, 2000);
            }
        });

        Common.Analytics.trackEvent('Load', 'Complete');
    }

    function onEditorPermissions(params) {
        if ( params.asc_getCanBranding() && (typeof config.customization == 'object') &&
             config.customization && config.customization.logo ) {

            var logo = $('#header-logo');
            if (config.customization.logo.imageEmbedded) {
                logo.html('<img src="'+config.customization.logo.imageEmbedded+'" style="max-width:124px; max-height:20px;"/>');
                logo.css({'background-image': 'none', width: 'auto', height: 'auto'});
            }

            if (config.customization.logo.url) {
                logo.attr('href', config.customization.logo.url);
            }
        }
        api.asc_setViewMode(true);
        api.asc_LoadDocument();
        api.Resize();
        api.zoomFitToWidth();
    }

    function showMask() {
        $('#id-loadmask').modal({
            backdrop: 'static',
            keyboard: false
        });
    }

    function hideMask() {
        $('#id-loadmask').modal('hide');
    }

    function onOpenDocument(progress) {
        var proc = (progress.asc_getCurrentFont() + progress.asc_getCurrentImage())/(progress.asc_getFontsCount() + progress.asc_getImagesCount());
        $('#loadmask-text').html('Loading document: ' + Math.min(Math.round(proc * 100), 100) + '%');
    }

    function onError(id, level, errData) {
        hidePreloader();

        var message;

        switch (id)
        {
            case Asc.c_oAscError.ID.Unknown:
                message = me.unknownErrorText;
                break;

            case Asc.c_oAscError.ID.ConvertationTimeout:
                message = me.convertationTimeoutText;
                break;

            case Asc.c_oAscError.ID.ConvertationError:
                message = me.convertationErrorText;
                break;

            case Asc.c_oAscError.ID.DownloadError:
                message = me.downloadErrorText;
                break;

            default:
                message = me.errorDefaultMessage.replace('%1', id);
                break;
        }

        if (level == Asc.c_oAscError.Level.Critical) {

            // report only critical errors
            Common.Gateway.reportError(id, message);

            $('#id-critical-error-title').text(me.criticalErrorTitle);
            $('#id-critical-error-message').text(message);
            $('#id-critical-error-close').off();
            $('#id-critical-error-close').on('click', function(){
                window.location.reload();
            });
        }
        else {
            $('#id-critical-error-title').text(me.notcriticalErrorTitle);
            $('#id-critical-error-message').text(message);
            $('#id-critical-error-close').off();
            $('#id-critical-error-close').on('click', function(){
                $('#id-critical-error-dialog').modal('hide');
            });
        }

        $('#id-critical-error-dialog').modal('show');

        Common.Analytics.trackEvent('Internal Error', id.toString());
    }

    function onExternalError(error) {
        if (error) {
            hidePreloader();
            $('#id-error-mask-title').text(error.title);
            $('#id-error-mask-text').text(error.msg);
            $('#id-error-mask').css('display', 'block');

            Common.Analytics.trackEvent('External Error', error.title);
        }
    }

    function onProcessMouse(data) {
        if (data.type == 'mouseup') {
            var e = document.getElementById('editor_sdk');
            if (e) {
                var r = e.getBoundingClientRect();
                api.OnMouseUp(
                    data.x - r.left,
                    data.y - r.top
                );
            }
        }
    }

    function onDownloadAs() {
        if (api) api.asc_DownloadAs(Asc.c_oAscFileType.DOCX, true);
    }

    // Helpers
    // -------------------------

    function onDocumentResize() {
        api && api.Resize();
    }

    function updateEmbedCode(){
        var $dlg = ApplicationView.modals.get('emded');
        var $txtwidth = $dlg.find('#txt-embed-width');
        var $txtheight = $dlg.find('#txt-embed-height');
        var newWidth  = parseInt($txtwidth.val()),
            newHeight = parseInt($txtheight.val());

        if (newWidth < minEmbedWidth)
            newWidth = minEmbedWidth;

        if (newHeight < minEmbedHeight)
            newHeight = minEmbedHeight;

        $dlg.find('#txt-embed-url').text(embedCode.replace('{embed-url}', embedConfig.embedUrl).replace('{width}', newWidth).replace('{height}', newHeight));

        $txtwidth.val(newWidth + 'px');
        $txtheight.val(newHeight + 'px');
    }

    function createController(){
        if (created)
            return me;

        me = this;
        created = true;

        $(window).resize(function(){
            onDocumentResize();
        });

        var ismodalshown = false;
        $(document.body).on('show.bs.modal', '.modal',
            function(e) {
                ismodalshown = true;
                api.asc_enableKeyEvents(false);
            }
        ).on('hidden.bs.modal', '.modal',
            function(e) {
                ismodalshown = false;
                api.asc_enableKeyEvents(true);
            }
        ).on('hidden.bs.dropdown', '.dropdown',
            function(e) {
                if ( !ismodalshown )
                    api.asc_enableKeyEvents(true);
            }
        ).on('blur', 'input, textarea',
            function(e) {
                if ( !ismodalshown ) {
                    if (!/area_id/.test(e.target.id) ) {
                        api.asc_enableKeyEvents(true);
                    }
                }
            }
        );

        $('#editor_sdk').on('click', function(e) {
            if ( e.target.localName == 'canvas' ) {
                e.currentTarget.focus();
            }
        });

        window["flat_desine"] = true;
        api = new Asc.asc_docs_api({
            'id-view'  : 'editor_sdk'
        });

        if (api){
            api.asc_registerCallback('asc_onError',                 onError);
            api.asc_registerCallback('asc_onDocumentContentReady',  onDocumentContentReady);
            api.asc_registerCallback('asc_onOpenDocumentProgress',  onOpenDocument);
            api.asc_registerCallback('asc_onPrintUrl',              onPrintUrl);

            api.asc_registerCallback('asc_onCountPages',            onCountPages);
//            api.asc_registerCallback('OnCurrentVisiblePage',    onCurrentPage);
            api.asc_registerCallback('asc_onCurrentPage',           onCurrentPage);

            // Initialize api gateway
            Common.Gateway.on('init',               loadConfig);
            Common.Gateway.on('opendocument',       loadDocument);
            Common.Gateway.on('showerror',          onExternalError);
            Common.Gateway.ready();
        }

        return me;
    }

    return {
        create                  : createController,
        errorDefaultMessage     : 'Error code: %1',
        unknownErrorText        : 'Unknown error.',
        convertationTimeoutText : 'Convertation timeout exceeded.',
        convertationErrorText   : 'Convertation failed.',
        downloadErrorText       : 'Download failed.',
        criticalErrorTitle      : 'Error',
        notcriticalErrorTitle   : 'Warning'
    }
})();