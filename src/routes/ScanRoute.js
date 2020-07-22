import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, injectIntl } from 'react-intl';
import { Form, Field } from 'react-final-form';
import _ from 'lodash';
import { stripesConnect } from '@folio/stripes/core';
import { KeyValue, MessageBanner, Modal, Row, Col, Pane, Paneset, PaneHeader, PaneHeaderIconButton, PaneMenu, Select, TextField, Layout } from '@folio/stripes/components';
import { useOkapiKy } from '@folio/stripes-reshare';

import ScanList from '../components/ScanList';
import scanActions from '../scanActions';
import STATUS from '../scanStatus';
import SelectedRequest from '../components/SelectedRequest';
import css from './ScanRoute.css';
import emptyPlaceholder from '../update-empty.svg';


// Need this outside the component as it gets re-rendered while the modal
// is still up. When tidying this and breaking into separate files I'll
// try and have the modal-promise-maker inject the whole thing into the DOM
// from within the promise so it can be self-contained
const itemModalHandlers = {};

const ScanRoute = ({ intl, mutator, resources: { currentAction, selScan, scans, scanData } }) => {
  const [showItemModal, setShowItemModal] = useState(false);
  const itemModalInput = useRef();
  const scanInput = useRef();
  const selData = scanData?.[selScan];
  const selReq = selData?.request;
  const updatedScanData = { ...scanData };
  const updateScan = (scannedAt, newData) => {
    // multiple updates might happen before re-rendering so we can't just use scanData
    updatedScanData[scannedAt] = { ...updatedScanData[scannedAt], ...newData };
    mutator.scanData.update({ [scannedAt]: updatedScanData[scannedAt] });
  };
  const okapiKy = useOkapiKy();

  // mod-rs action names are translated in stripes-reshare, but some are specific to this app
  // TODO: this can easily be factored out into a hook once stripes-core upgrades react-intl
  // so useIntl is available
  const trAction = (action, suffix = '') => {
    if (`ui-update.actions.${action}` in intl.messages) {
      return intl.formatMessage({ id: `ui-update.actions.${action}${suffix}` });
    }
    return intl.formatMessage({ id: `stripes-reshare.actions.${action}${suffix}` });
  };

  const getItemBarcode = () => {
    const itemBarcodePromise = new Promise((resolve, reject) => {
      itemModalHandlers.cancel = () => {
        setShowItemModal(false);
        reject(new Error(intl.formatMessage({ id: 'ui-update.error.dismissed' })));
      };
      itemModalHandlers.submit = (values) => {
        setShowItemModal(false);
        resolve(values.itemBarcode);
      };
    });
    setShowItemModal(true);
    return itemBarcodePromise;
  };

  const actionChange = e => {
    mutator.scans.replace([]);
    mutator.scanData.replace({});
    mutator.currentAction.replace(e.target.value);
    scanInput.current.focus();
  };

  const onSubmit = (values, form) => {
    // scannedAt functions as the id of the scan rather than reqId, enabling
    const scannedAt = Date.now();
    const updateThis = newData => updateScan(scannedAt, newData);
    updateThis({ status: STATUS.PENDING, hrid: values.hrid });
    mutator.scans.replace([scannedAt, ...scans]);
    mutator.selScan.replace(scannedAt);

    // These take performAction even though it's defined in this scope in hopes of this one day being its own file
    const scanHandlers = {
      supplierCheckInToReshare: async (requestPromise, performAction) => {
        const itemBarcode = await getItemBarcode();
        const request = await requestPromise;
        return performAction(request, 'supplierCheckInToReshare', { itemBarcode });
      },
    };

    const performAction = async (request, action, actionParams = {}) => {
      if (!request.validActions.includes(action)) {
        throw new Error(intl.formatMessage({ id: 'ui-update.error.notValidForState' }));
      }
      return okapiKy.post(`rs/patronrequests/${request.id}/performAction`, { json: { action, actionParams } });
    };

    // Reset form so user can proceed to scan the next item while this is loading
    form.initialize(_.omit(values, 'hrid'));

    // Give scanHandlers a promise rather than a resolved request so they can
    // choose to include logic that happens without waiting for the request or
    // merely await it.
    const requestPromise = (async () => {
      const results = await okapiKy.get('rs/patronrequests', { searchParams: { match: 'hrid', term: values.hrid } }).json();
      if (results?.length === 1) {
        const request = results[0];
        updateThis({ request });
        return request;
      } else if (results?.length > 1) {
        // Should never happen in real world use, may happen in dev environments where requester and supplier are the same tenant
        throw new Error(intl.formatMessage({ id: 'ui-update.error.multipleRequestsForHRID' }));
      }
      throw new Error(intl.formatMessage({ id: 'ui-update.error.noRequest' }));
    })();

    (async () => {
      if (currentAction in scanHandlers) {
        await scanHandlers[currentAction](requestPromise, performAction);
      }
      const request = await requestPromise;
      if (!(currentAction in scanHandlers)) {
        await performAction(request, currentAction);
      }
      const updated = await okapiKy.get(`rs/patronrequests/${request.id}`).json();
      updateThis({ request: updated, status: STATUS.SUCCESS });
    })()
      .catch(error => {
        updateThis({ status: STATUS.FAIL, error });
      });
  };

  return (
    <Paneset>
      <Pane
        defaultWidth="fill"
        renderHeader={renderProps => (
          <PaneHeader
            renderProps={renderProps}
            header={(
              <Row style={{ width: '100%' }}>
                <Col xs={6}>
                  <Select onChange={actionChange} value={currentAction || undefined} marginBottom0>
                    {scanActions.map(action => (
                      <option key={action} value={action}>{trAction(action)}</option>
                    ))}
                  </Select>
                </Col>
                <Col xs={6}>
                  <Form
                    onSubmit={onSubmit}
                    render={({ handleSubmit, form }) => (
                      <form onSubmit={handleSubmit}>
                        <Field name="hrid" component={TextField} marginBottom0 inputRef={scanInput} autoFocus placeholder="Scan or enter barcode..." />
                      </form>
                    )}
                  />
                </Col>
              </Row>
            )}
          />
        )}
      >
        {scans?.length > 0 &&
          <ScanList
            scans={scans}
            scanData={scanData}
            selectedScan={selScan}
            onRowClick={(e, row) => mutator.selScan.replace(row.scannedAt)}
          />
        }
      </Pane>
      {!selData && (
        <Pane
          defaultWidth="40%"
          renderHeader={null}
          padContent={false}
        >
          <div className={css.emptyPlaceholder}>
            <img src={emptyPlaceholder} alt="" />
            <Layout className="marginTop1"><FormattedMessage id="ui-update.placeholder" /></Layout>
          </div>
        </Pane>
      )}
      {selData && (
        <Pane
          defaultWidth="40%"
          renderHeader={renderProps => (
            <PaneHeader
              {...renderProps}
              paneTitle={selData.hrid}
            />
          )}
          lastMenu={selReq?.id &&
            <PaneMenu>
              <PaneHeaderIconButton
                key="icon-request"
                icon="document"
                to={`${selReq.isRequester ? 'request' : 'supply'}/requests/view/${selReq.id}`}
              />
            </PaneMenu>
          }
        >
          {selData.status === STATUS.SUCCESS && (
            <MessageBanner type="success">
              <FormattedMessage id={trAction(currentAction, '.success')} />
            </MessageBanner>
          )}
          {selData.status === STATUS.FAIL && (
            <MessageBanner type="error">
              <KeyValue label={<FormattedMessage id={trAction(currentAction, '.error')} />}>
                {selData.error?.message || ''}
              </KeyValue>
            </MessageBanner>
          )}
          {selReq && <SelectedRequest request={selReq} />}
        </Pane>
      )}
      <Modal
        open={showItemModal}
        onOpen={() => itemModalInput.current.focus()}
        onClose={() => itemModalHandlers.cancel()}
        label={<FormattedMessage id="ui-update.checkInPrompt" />}
        dismissible
        restoreFocus
      >
        <Form
          onSubmit={itemModalHandlers.submit}
          render={({ handleSubmit }) => (
            <form onSubmit={handleSubmit} autoComplete="off">
              <Field name="itemBarcode" inputRef={itemModalInput} component={TextField} />
            </form>
          )}
        />
      </Modal>
    </Paneset>
  );
};

ScanRoute.manifest = {
  currentAction: { initialValue: scanActions[0] },
  selScan: {},
  scans: { initialValue: [] },
  scanData: { initialValue: {} },
};

ScanRoute.propTypes = {
  intl: PropTypes.object.isRequired,
  mutator: PropTypes.object.isRequired,
  resources: PropTypes.object.isRequired,
};

export default stripesConnect(injectIntl(ScanRoute));
